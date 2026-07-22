import { Tier } from './enums';

export interface User {
  id: string;
  email: string;
  displayName: string;
  tier: Tier;
  adFree: boolean;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}
