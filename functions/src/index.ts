/* eslint-disable max-len */
import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2/options";
import {defineString} from "firebase-functions/params";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

initializeApp();
setGlobalOptions({region: "southamerica-east1"});

const BOOTSTRAP_EMAIL = defineString("bootstrap.admin_email");

type Role = "admin"|"user"|"staff";

type CreatePayload = {
  email: string;
  phone: string;
  dob: string; // "DD/MM/AAAA" ou "AAAA-MM-DD"
  carModel: string;
  role?: Role;
};

const auth = getAuth();
const db = getFirestore();

// eslint-disable-next-line require-jsdoc
function normalizeDob(dob: string): string {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
    const parts = dob.split("/");
    const d = parts[0];
    const m = parts[1];
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return dob;
}

// eslint-disable-next-line require-jsdoc
async function callerIsAdmin(uid: string): Promise<boolean> {
  const u = await auth.getUser(uid);
  const role = (u.customClaims?.role as Role) || null;
  return role === "admin";
}

/**
 * Cria usuário com senha temporária e registra perfil/auditoria.
 * Campos obrigatórios: email, phone, dob, carModel.
 * Role padrão: "user".
 */
export const createUserWithTempPassword = onCall(
  async (req: CallableRequest<CreatePayload>) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Faça login.");
    }
    const isAdm = await callerIsAdmin(req.auth.uid);
    if (!isAdm) {
      throw new HttpsError("permission-denied", "Apenas admin.");
    }

    const data = req.data;
    const email = data?.email;
    const phone = data?.phone;
    const dob = data?.dob;
    const carModel = data?.carModel;
    const role: Role = data?.role ?? "user";

    if (!email || !phone || !dob || !carModel) {
      throw new HttpsError(
        "invalid-argument",
        "Campos obrigatórios: email, phone, dob, carModel."
      );
    }
    if (!["admin", "user", "staff"].includes(role)) {
      throw new HttpsError("invalid-argument", "Role inválida.");
    }

    const temp = Math.random().toString(36).slice(-8)+"Aa1!";

    const userRec = await auth.createUser({email: email, password: temp});
    await auth.setCustomUserClaims(userRec.uid, {role: role});

    await db.collection("profiles").doc(userRec.uid).set({
      email: email,
      phone: phone,
      dob: normalizeDob(dob),
      carModel: carModel,
      role: role,
      isActive: true,
      createdBy: req.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection("audit_log").add({
      actor: req.auth.uid,
      action: "CREATE_USER",
      target: userRec.uid,
      payload: {
        email: email,
        phone: phone,
        dob: normalizeDob(dob),
        carModel: carModel,
        role: role,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return {uid: userRec.uid, tempPassword: temp};
  }
);

/**
 * Concede role "admin" a um usuário por email.
 * Somente o email configurado em bootstrap.admin_email pode usar.
 */
export const grantAdminByEmail = onCall(
  async (req: CallableRequest<{email: string}>) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Login necessário.");
    }

    const caller = await auth.getUser(req.auth.uid);
    const bootstrap = BOOTSTRAP_EMAIL.value();
    if (caller.email !== bootstrap) {
      throw new HttpsError("permission-denied", "Não autorizado.");
    }

    const targetEmail = req.data?.email;
    if (!targetEmail) {
      throw new HttpsError("invalid-argument", "Informe o email.");
    }

    const targetUid = (await auth.getUserByEmail(targetEmail)).uid;
    await auth.setCustomUserClaims(targetUid, {role: "admin"});

    return {ok: true, uid: targetUid};
  }
);
