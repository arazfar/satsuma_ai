import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous, Password({
    id: "installation",
    profile(params) {
      if (typeof params.email !== "string" || !/^[a-f0-9-]{36}@installation\.satsuma\.invalid$/.test(params.email)) throw new Error("Invalid installation credential.");
      return { email: params.email, isAnonymous: true };
    },
    validatePasswordRequirements(password) {
      if (!/^[a-f0-9-]{72}$/.test(password)) throw new Error("Invalid installation credential.");
    },
  })],
});
