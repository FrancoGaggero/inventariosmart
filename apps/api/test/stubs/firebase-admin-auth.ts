/** Stub de `firebase-admin/auth` para Jest (ver firebase-admin-app.ts). */
export const getAuth = () => ({
  verifyIdToken: async (_token: string): Promise<{ uid: string; email?: string }> => {
    throw new Error('firebase-admin es un stub en los tests; usá un doble de TokenVerifier');
  },
});
