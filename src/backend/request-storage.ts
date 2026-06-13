import { AsyncLocalStorage } from "async_hooks";

export const requestStorage = new AsyncLocalStorage<any>();
