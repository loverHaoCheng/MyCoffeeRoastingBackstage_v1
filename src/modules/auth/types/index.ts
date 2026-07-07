export interface AuthCredentialsInput {
  email: string;
  password: string;
}

export interface RegisterInput extends AuthCredentialsInput {
  passwordConfirm: string;
}

export interface PocketBaseUserRecord {
  email: string;
  id: string;
  verified?: boolean;
  username?: string;
}

