export interface JwtPayload {
  sub: number;
  id_rol: number;
  passwordVersion: number;
  accessId?: string;
}
