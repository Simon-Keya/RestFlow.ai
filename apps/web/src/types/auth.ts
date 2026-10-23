import type { Role } from "@/lib/constants/roles";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

export interface LoginResponse {
  access_token: string;
  user: Pick<User, "id" | "email" | "name" | "role">;
}
