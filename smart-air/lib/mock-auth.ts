export type MockUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  password: string;
};

export const MOCK_USERS: MockUser[] = [
  { id: "1", username: "admin", role: "admin", password: "Admin123" },
  { id: "2", username: "user", role: "user", password: "User123" },
];
