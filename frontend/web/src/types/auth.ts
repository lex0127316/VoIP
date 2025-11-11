export type Session = {
  userId: string;
  tenantId: string;
  exp: number;
  iat: number;
};

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type SessionResponse = {
  session: Session | null;
};


