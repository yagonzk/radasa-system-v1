export interface ApiErrorResponse {
  message: string;
  details?: unknown;
  issues?: unknown[];
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
}

export interface LoginResponse {
  token: string;
  user: AuthenticatedUser;
}
