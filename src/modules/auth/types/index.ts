export interface AuthCredentialsInput {
  email: string;
  password: string;
}

export interface RegisterInput extends AuthCredentialsInput {
  passwordConfirm: string;
}

export interface AuthEmailActionResult {
  message: string;
  success: true;
}

export interface RegisterResult {
  email: string;
  message: string;
  verificationEmailSent: boolean;
  verificationRequired: true;
}

export interface PocketBaseUserRecord {
  email: string;
  id: string;
  verified?: boolean;
  username?: string;
}
