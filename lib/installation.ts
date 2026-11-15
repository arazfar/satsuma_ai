import * as Crypto from "expo-crypto";
import { authStorage } from "./authStorage";

type Credential = { email: string; password: string };
const credentialKey = "satsumaInstallationCredential";
let pending: Promise<Credential> | null = null;

export function installationCredential(): Promise<Credential> {
  if (!pending) pending = loadCredential().catch(error => { pending = null; throw error; });
  return pending;
}

async function loadCredential(): Promise<Credential> {
  const saved = await authStorage.getItem(credentialKey);
  if (saved) {
    const value: unknown = JSON.parse(saved);
    if (typeof value !== "object" || value === null || !("email" in value) || !("password" in value) || typeof value.email !== "string" || typeof value.password !== "string" || !/^[a-f0-9-]{36}@installation\.satsuma\.invalid$/.test(value.email) || !/^[a-f0-9-]{72}$/.test(value.password)) throw new Error("Your saved installation credential could not be read. It has not been replaced.");
    return { email: value.email, password: value.password };
  }
  const credential = { email: `${Crypto.randomUUID()}@installation.satsuma.invalid`, password: Crypto.randomUUID() + Crypto.randomUUID() };
  await authStorage.setItem(credentialKey, JSON.stringify(credential));
  return credential;
}

export async function authenticateInstallation(signIn: (provider: string, params: Record<string, string>) => Promise<unknown>) {
  const credential = await installationCredential();
  try { await signIn("installation", { ...credential, flow: "signIn" }); }
  catch { await signIn("installation", { ...credential, flow: "signUp" }); }
}
