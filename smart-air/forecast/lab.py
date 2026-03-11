import os
import importlib.util
import requests
from datetime import datetime, timedelta

# ===============================
# CONFIG
# ===============================

# 1. ใช้ API_BASE_URL จาก env (fallback เป็น localhost:4000)
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:4000")

# 2. ดึง API Key จากที่ Backend แนบมาให้ตอนสั่ง Child Process
AUTH_TOKEN = os.environ.get("API_KEY", "")

# 3. จำกัดให้พยากรณ์เฉพาะ location ที่ส่งมา (ถ้ามี)
FORECAST_LOCATION_CODE = os.environ.get("FORECAST_LOCATION_CODE", "").strip()
FORECAST_END_DATE = os.environ.get("FORECAST_END_DATE", "").strip()
FORECAST_ACTUAL_DATE = os.environ.get("FORECAST_ACTUAL_DATE", "").strip()

LOCATIONS = [
    ("57T", "เชียงราย",       19.907804,  99.831798),
    ("58T", "แม่ฮ่องสอน",    19.299105,  97.966982),
    ("82T", "หนองคาย",        17.868331, 102.729021),
    ("83T", "อุบลราชธานี",   15.241696, 104.853474),
    ("86T", "พิษณุโลก",       16.814097, 100.259637),
    ("79T", "กาญจนบุรี",      14.025679,  99.529249),
    ("05T", "กรุงเทพมหานคร", 13.667666, 100.618481),
    ("87T", "ตราด",            12.247411, 102.517208),
    ("42T", "สุราษฎร์ธานี",   9.107120,  99.348683),
    ("62T", "นราธิวาส",        6.423428, 101.822979),
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ===============================
# LOAD RF INFERENCE (Script/inference.py)
# ===============================

_spec = importlib.util.spec_from_file_location(
    "inference", os.path.join(BASE_DIR, "Script", "inference.py")
)
inference = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(inference)

LAG_DAYS = inference.LAG_DAYS

# ===============================
# MAIN JOB
# ===============================

def run_job():
    api_session = requests.Session()
    
    # 3. ตั้งค่า Headers ให้ทุกการร้องขอ (GET/POST) แนบ Token ไปด้วย
    api_session.headers.update({
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    })

    if FORECAST_LOCATION_CODE:
        codes = [FORECAST_LOCATION_CODE]
    else:
        codes = [loc[0] for loc in LOCATIONS]

    # แก้ไขการวนลูป (เนื่องจาก LOCATIONS เป็น List ของ Tuple)
    for code in codes:
        
        # 4. GET ข้อมูลจาก Local Backend
        try:
            if FORECAST_END_DATE:
                end_date = datetime.strptime(FORECAST_END_DATE, "%Y-%m-%d").date()
                start_date = end_date - timedelta(days=LAG_DAYS - 1)
                params = {
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d"),
                }
            else:
                params = None

            r = api_session.get(
                f"{API_BASE_URL}/api/pollution/actual/{code}",
                params=params
            )
            
            # เช็คว่า Backend ตอบกลับมาสำเร็จหรือไม่
            if r.status_code != 200:
                print(f"Skipping {code}: Failed to fetch data (Status {r.status_code})")
                continue
                
            history = r.json().get("data", [])
        except Exception as e:
            print(f"Connection error for {code}: {e}")
            continue

        if FORECAST_END_DATE:
            try:
                end_date = datetime.strptime(FORECAST_END_DATE, "%Y-%m-%d").date()
                start_date = end_date - timedelta(days=LAG_DAYS - 1)
            except Exception as e:
                print(f"Invalid FORECAST_END_DATE: {e}")
                continue

            history_by_date = {row["date"]: row for row in history if row.get("date")}
            date_cursor = start_date
            filled_history = []
            last_row = None
            first_row = None

            for row_date in sorted(history_by_date.keys()):
                first_row = history_by_date[row_date]
                break

            while date_cursor <= end_date:
                date_str = date_cursor.strftime("%Y-%m-%d")
                if date_str in history_by_date:
                    last_row = history_by_date[date_str]
                    filled_history.append(last_row)
                else:
                    if last_row is not None:
                        cloned = dict(last_row)
                        cloned["date"] = date_str
                        filled_history.append(cloned)
                    elif first_row is not None:
                        cloned = dict(first_row)
                        cloned["date"] = date_str
                        filled_history.append(cloned)
                date_cursor += timedelta(days=1)

            history = filled_history

            if len(history) < LAG_DAYS and history:
                missing = LAG_DAYS - len(history)
                first = history[0]
                prepend = []
                for i in range(missing, 0, -1):
                    date_str = (start_date - timedelta(days=i)).strftime("%Y-%m-%d")
                    cloned = dict(first)
                    cloned["date"] = date_str
                    prepend.append(cloned)
                history = prepend + history

        rows = [
            {
                "date":              row["date"],
                "station":           code,
                "temperature":       row["temp"],
                "dew_point":         row["dew_point"],
                "relative_humidity": row["humidity"],
                "surface_pressure":  row["pressure"],
                "wind_speed":        row["wind_speed"],
                "wind_direction":    row["wind_direction"],
                "precipitation":     row["precipitation"],
                "pm":                row["pm"],
            }
            for row in history
            if row.get("pm") is not None
        ]
        
        # ถ่ายทอดข้อมูลให้ Model
        try:
            df_pred = inference.forecast(rows)
        except Exception as e:
            print(f"Inference error for {code}: {e}")
            continue

        predictions = [
            {"predicted_for": row["date"], "pm_predicted": row["pm25_forecast"]}
            for _, row in df_pred.iterrows()
        ]

        # 5. POST predictions กลับไปที่ Local Backend
        try:
            params = {"actual_date": FORECAST_ACTUAL_DATE} if FORECAST_ACTUAL_DATE else None
            r = api_session.post(
                f"{API_BASE_URL}/api/pollution/predicted/{code}",
                params=params,
                json=predictions
            )
            if r.status_code == 200:
                print(f"Success for {code}")
            else:
                print(f"Failed to post prediction for {code}: {r.status_code}")
        except Exception as e:
            print(f"Post error for {code}: {e}")
            
    # แจ้งสถานะเมื่อจบครบทุกสถานี
    print("ALL_JOBS_COMPLETED")

if __name__ == "__main__":
    run_job()
