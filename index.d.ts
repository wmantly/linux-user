export type ErrorType = undefined | string | Error | null;

export interface UserCreationArgs {
  username: string;
  create_home: boolean;
  shell?: string | null;
  home_dir?: string;
  expiredate?: string | Date;
  skel?: string;
  system?: boolean;
  selinux_user?: string;
  other_args?: string | string[];
}

export interface UserInfo {
  username: string;
  password: string;
  uid: number;
  gid: number;
  fullname: string;
  homedir: string;
  shell: string;
}

export interface GroupInfo {
  groupname: string;
  password: string;
  gid: number;
  members: string[];
}

export interface UserExpirationInfo {
  changed: Date | null;
  passwordExpires: null | Date;
  inactive: null | Date;
  accountExpires: null | Date;
  minDays: number;
  maxDays: number;
  warnDays: number;
}

export interface UserExpirationEditArgs {
  lastday: Date | string;
  expiredate: Date | string;
  inactive: Date | string;
  minDays: number;
  maxDays: number;
  warnDays: number;
}

export default class LinuxUser {
  static addUser(
    args: UserCreationArgs | string,
    callback: (error: ErrorType, user?: UserInfo | null) => void
  ): void;
  static removeUser(username: string, callback: (error: ErrorType) => void): void;
  static getUserGroups(
    username: string,
    callback: (error: ErrorType, groups?: string[]) => void
  ): void;
  static getUsers(callback: (error: ErrorType, users?: UserInfo[]) => void): void;
  static getUserInfo(
    username: string,
    callback: (error: ErrorType, user?: UserInfo | null) => void
  ): void;
  static setPassword(
    username: string,
    password: string,
    callback: (error: ErrorType) => void
  ): void;
  static addGroup(
    groupName: string,
    callback: (error: ErrorType, group?: GroupInfo | null) => void
  ): void;
  static removeGroup(groupName: string, callback: (error: ErrorType) => void): void;
  static getGroups(
    callback: (error: ErrorType, groups?: GroupInfo[]) => void
  ): void;
  static getGroupInfo(
    groupName: string,
    callback: (error: ErrorType, group?: GroupInfo | null) => void
  ): void;
  static addUserToGroup(
    username: string,
    groupName: string,
    callback: (error: ErrorType) => void
  ): void;
  static getExpiration(
    username: string,
    callback: (error: ErrorType, data?: UserExpirationInfo) => void
  ): void;
  static setExpiration(
    username: string,
    args: UserExpirationEditArgs,
    callback: (error: ErrorType, data: any) => void
  ): void;
  static verifySSHKey(
    key: string,
    callback: (error: ErrorType, done?: boolean) => void
  ): void;
  static addSSHtoUser(
    username: string,
    key: string,
    callback: (error: ErrorType, done?: boolean) => void
  ): void;
  static validateUsername(username: string): boolean;
  /** Read-only subset that does not require root privileges. */
  static nonRoot: LinuxUserReadOnly;
}

/** Read-only functions that do not require root privileges. */
export interface LinuxUserReadOnly {
  getUsers(callback: (error: ErrorType, users?: UserInfo[]) => void): void;
  getGroups(callback: (error: ErrorType, groups?: GroupInfo[]) => void): void;
  getUserInfo(
    username: string,
    callback: (error: ErrorType, user?: UserInfo | null) => void
  ): void;
  getUserGroups(
    username: string,
    callback: (error: ErrorType, groups?: string[]) => void
  ): void;
  getExpiration(
    username: string,
    callback: (error: ErrorType, data?: UserExpirationInfo) => void
  ): void;
  validateUsername(username: string): boolean;
  verifySSHKey(
    key: string,
    callback: (error: ErrorType, done?: boolean) => void
  ): void;
  promise: LinuxUserPromiseFactory;
}

/** Result of `linuxUser.promise()` -- all methods return Promises. */
export interface LinuxUserPromise {
  addUser(args: UserCreationArgs | string): Promise<UserInfo>;
  removeUser(username: string): Promise<void>;
  getUserGroups(username: string): Promise<string[]>;
  getUsers(): Promise<UserInfo[]>;
  getUserInfo(username: string): Promise<UserInfo | null>;
  setPassword(username: string, password: string): Promise<void>;
  addGroup(groupName: string): Promise<GroupInfo>;
  removeGroup(groupName: string): Promise<void>;
  getGroups(): Promise<GroupInfo[]>;
  getGroupInfo(groupName: string): Promise<GroupInfo | null>;
  addUserToGroup(username: string, groupName: string): Promise<void>;
  getExpiration(username: string): Promise<UserExpirationInfo>;
  setExpiration(username: string, args: UserExpirationEditArgs): Promise<any>;
  verifySSHKey(key: string): Promise<any>;
  addSSHtoUser(username: string, key: string): Promise<boolean>;
  validateUsername(username: string): boolean;
}

/** Read-only promise subset (see LinuxUserReadOnly). */
export interface LinuxUserReadOnlyPromise {
  getUsers(): Promise<UserInfo[]>;
  getGroups(): Promise<GroupInfo[]>;
  getUserInfo(username: string): Promise<UserInfo | null>;
  getUserGroups(username: string): Promise<string[]>;
  getExpiration(username: string): Promise<UserExpirationInfo>;
  validateUsername(username: string): boolean;
  verifySSHKey(key: string): Promise<any>;
}

export interface LinuxUserPromiseFactory {
  (promisifyFn?: (fn: Function) => Function): LinuxUserPromise;
  nonRoot(promisifyFn?: (fn: Function) => Function): LinuxUserReadOnlyPromise;
}

/** Non-root import: `import linuxUser from 'linux-user/non-root'`. */
export declare const nonRoot: LinuxUserReadOnly;