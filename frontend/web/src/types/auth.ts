export type Session = {
  userId: string;
  tenantId: string;
  exp: number;
  iat: number;
} | null;


