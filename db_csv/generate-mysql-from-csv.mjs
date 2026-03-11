import fs from "node:fs";
import path from "node:path";

const INPUT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const OUTPUT_FILE = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(INPUT_DIR, "smart_air_mysql.sql");

const DB_NAME = process.env.MYSQL_DB_NAME || "smart_air";

const readText = (filePath) => fs.readFileSync(filePath, "utf8");

const parseCsv = (text) => {
  const rows = [];
  let current = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    current.push(cell);
    cell = "";
  };
  const pushRow = () => {
    // Skip completely empty trailing lines
    if (current.length === 1 && current[0] === "") {
      current = [];
      return;
    }
    rows.push(current);
    current = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === "\"") {
        const next = text[i + 1];
        if (next === "\"") {
          cell += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      pushCell();
      continue;
    }

    if (ch === "\r") {
      // ignore, handle on \n
      continue;
    }

    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }

    cell += ch;
  }

  // Flush last row if file doesn't end with newline
  pushCell();
  if (current.length > 1 || current[0] !== "") {
    pushRow();
  }

  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0];
  const records = rows.slice(1).map((r) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = r[i] ?? "";
    }
    return obj;
  });
  return { headers, records };
};

const pad2 = (n) => String(n).padStart(2, "0");
const pad3 = (n) => String(n).padStart(3, "0");

const formatMysqlDatetime6UTC = (date) => {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const mm = pad2(date.getUTCMinutes());
  const ss = pad2(date.getUTCSeconds());
  const ms = pad3(date.getUTCMilliseconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}.${ms}000`;
};

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;

const looksLikeNumber = (value) => /^-?\d+(\.\d+)?$/.test(value);
const looksLikeIsoUtc = (value) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value);
const looksLikeDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const toSqlValue = (raw, columnName) => {
  if (raw === "" || raw === null || raw === undefined) return "NULL";

  const value = String(raw);

  // Keep these as DATE
  if ((columnName === "date" || columnName === "predicted_for") && looksLikeDateOnly(value)) {
    return sqlString(value);
  }

  // Convert ISO UTC timestamps to DATETIME(6)
  if (
    (columnName === "created_at" ||
      columnName === "fetched_at" ||
      columnName === "predicted_at") &&
    looksLikeIsoUtc(value)
  ) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return sqlString(formatMysqlDatetime6UTC(date));
    }
  }

  // Numeric columns from CSV exports
  if (looksLikeNumber(value)) {
    return value;
  }

  return sqlString(value);
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const emitInsertStatements = ({ tableName, headers, records, batchSize = 500 }) => {
  if (records.length === 0) return `-- No rows for ${tableName}\n`;

  const cols = headers.map((h) => `\`${h}\``).join(", ");
  let sql = `-- ${tableName}: ${records.length} rows\n`;

  for (const group of chunk(records, batchSize)) {
    const values = group
      .map((row) => {
        const rowValues = headers.map((h) => toSqlValue(row[h], h)).join(", ");
        return `(${rowValues})`;
      })
      .join(",\n");

    sql += `INSERT INTO \`${tableName}\` (${cols}) VALUES\n${values};\n`;
  }

  return sql + "\n";
};

const main = () => {
  const locationPath = path.join(INPUT_DIR, "location.csv");
  const actualPath = path.join(INPUT_DIR, "pm_actual.csv");
  const predictionPath = path.join(INPUT_DIR, "pm_prediction.csv");

  for (const p of [locationPath, actualPath, predictionPath]) {
    if (!fs.existsSync(p)) {
      console.error(`Missing CSV: ${p}`);
      process.exit(1);
    }
  }

  const location = parseCsv(readText(locationPath));
  const actual = parseCsv(readText(actualPath));
  const prediction = parseCsv(readText(predictionPath));

  let out = "";
  out += "-- Generated from CSV exports\n";
  out += `-- Source dir: ${INPUT_DIR}\n`;
  out += `-- Output: ${OUTPUT_FILE}\n`;
  out += `-- Database: ${DB_NAME}\n\n`;

  out += "SET NAMES utf8mb4;\n";
  out += "SET time_zone = '+00:00';\n";
  out += "SET FOREIGN_KEY_CHECKS = 0;\n\n";

  out += `DROP DATABASE IF EXISTS \`${DB_NAME}\`;\n`;
  out += `CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n`;
  out += `USE \`${DB_NAME}\`;\n\n`;

  out += "CREATE TABLE `location` (\n";
  out += "  `id` INT NOT NULL,\n";
  out += "  `code` VARCHAR(10) NOT NULL,\n";
  out += "  `province` VARCHAR(100) NOT NULL,\n";
  out += "  `latitude` DECIMAL(9,6) NULL,\n";
  out += "  `longitude` DECIMAL(9,6) NULL,\n";
  out += "  `created_at` DATETIME(6) NOT NULL,\n";
  out += "  PRIMARY KEY (`id`),\n";
  out += "  UNIQUE KEY `uq_location_code` (`code`)\n";
  out += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n";

  out += "CREATE TABLE `pm_actual` (\n";
  out += "  `id` INT NOT NULL,\n";
  out += "  `location_id` INT NOT NULL,\n";
  out += "  `date` DATE NOT NULL,\n";
  out += "  `pm` DECIMAL(8,4) NULL,\n";
  out += "  `temp` DECIMAL(5,2) NULL,\n";
  out += "  `dew_point` DECIMAL(5,2) NULL,\n";
  out += "  `humidity` SMALLINT NULL,\n";
  out += "  `pressure` DECIMAL(7,2) NULL,\n";
  out += "  `wind_speed` DECIMAL(5,2) NULL,\n";
  out += "  `precipitation` DECIMAL(6,2) NULL,\n";
  out += "  `wind_direction` DECIMAL(5,2) NULL,\n";
  out += "  `fetched_at` DATETIME(6) NOT NULL,\n";
  out += "  PRIMARY KEY (`id`),\n";
  out += "  UNIQUE KEY `uq_pm_actual_location_date` (`location_id`, `date`),\n";
  out += "  KEY `idx_pm_actual_date` (`date`),\n";
  out += "  KEY `idx_pm_actual_location_id` (`location_id`),\n";
  out += "  CONSTRAINT `fk_pm_actual_location` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`)\n";
  out += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n";

  out += "CREATE TABLE `pm_prediction` (\n";
  out += "  `id` INT NOT NULL,\n";
  out += "  `pm_actual_id` INT NOT NULL,\n";
  out += "  `predicted_for` DATE NOT NULL,\n";
  out += "  `pm_predicted` DECIMAL(8,4) NULL,\n";
  out += "  `predicted_at` DATETIME(6) NOT NULL,\n";
  out += "  PRIMARY KEY (`id`),\n";
  out += "  UNIQUE KEY `uq_pm_prediction_actual_date` (`pm_actual_id`, `predicted_for`),\n";
  out += "  KEY `idx_pm_prediction_actual_id` (`pm_actual_id`),\n";
  out += "  KEY `idx_pm_prediction_for` (`predicted_for`),\n";
  out += "  CONSTRAINT `fk_pm_prediction_actual` FOREIGN KEY (`pm_actual_id`) REFERENCES `pm_actual` (`id`) ON DELETE CASCADE\n";
  out += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n";

  out += "CREATE TABLE `account` (\n";
  out += "  `id` INT NOT NULL AUTO_INCREMENT,\n";
  out += "  `username` VARCHAR(50) NOT NULL,\n";
  out += "  `password_hash` VARCHAR(255) NOT NULL,\n";
  out += "  `role` ENUM('ADMIN','USER') NOT NULL,\n";
  out += "  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n";
  out += "  PRIMARY KEY (`id`),\n";
  out += "  UNIQUE KEY `uq_account_username` (`username`)\n";
  out += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n";

  out += emitInsertStatements({
    tableName: "location",
    headers: location.headers,
    records: location.records,
  });
  out += emitInsertStatements({
    tableName: "pm_actual",
    headers: actual.headers,
    records: actual.records,
  });
  out += emitInsertStatements({
    tableName: "pm_prediction",
    headers: prediction.headers,
    records: prediction.records,
  });

  // Default accounts. Change passwords before using anywhere real.
  out += "-- Seed accounts (password_hash uses SHA2-256)\n";
  out += "INSERT INTO `account` (`username`, `password_hash`, `role`) VALUES\n";
  out += "  ('admin', SHA2('admin123', 256), 'ADMIN'),\n";
  out += "  ('user', SHA2('user123', 256), 'USER');\n\n";

  out += "SET FOREIGN_KEY_CHECKS = 1;\n";

  fs.writeFileSync(OUTPUT_FILE, out, "utf8");
  console.log(`Wrote: ${OUTPUT_FILE}`);
};

main();

