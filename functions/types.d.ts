export interface Env {
  DB: D1Database;
  JWT_SECRET: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
  DISCORD_REDIRECT_URI: string
}

export interface ITagDB {
  id: number;
  name: string;
  display_name: string;
  description: string;
  deleted: number;
  created_at: string;
  updated_at: string;
  deleted_at: string;
}

export interface IUserDB {
  id: number
  guid: string
  display_name: string
  discord_id: string
  is_admin: number
  created_at: string;
  updated_at: string;
}

export interface ITagVM {
  id: number;
  name: string;
}

export interface ICreateEditTagVM {
  id: number;
  name: string;
  display_name: string;
  description: string;
  deleted: boolean;
}

export interface IJWTAuthPayload {
  sub: string
  guid: string
  name: string
  discord_id: string
  admin: boolean
}
