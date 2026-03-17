declare module "bcryptjs" {
  export function compare(
    password: string,
    hash: string,
  ): Promise<boolean>;

  export function compareSync(password: string, hash: string): boolean;

  export function hash(
    password: string,
    saltOrRounds: string | number,
  ): Promise<string>;

  export function hashSync(
    password: string,
    saltOrRounds: string | number,
  ): string;

  export function genSalt(rounds?: number): Promise<string>;

  export function genSaltSync(rounds?: number): string;

  const bcrypt: {
    compare: typeof compare;
    compareSync: typeof compareSync;
    hash: typeof hash;
    hashSync: typeof hashSync;
    genSalt: typeof genSalt;
    genSaltSync: typeof genSaltSync;
  };

  export default bcrypt;
}
