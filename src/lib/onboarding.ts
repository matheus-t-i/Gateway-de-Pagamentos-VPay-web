/**
 * Credenciais temporárias do onboarding (conta ainda sem JWT).
 * Ficam apenas em sessionStorage — some ao fechar a aba. Necessárias porque o
 * envio de documentos reverifica e-mail+senha a cada request (sem token).
 */
const KEY = 'vpay_onboarding';

export type OnboardingCreds = { email: string; senha: string };

export function salvarCredsOnboarding(creds: OnboardingCreds) {
  sessionStorage.setItem(KEY, JSON.stringify(creds));
}

export function lerCredsOnboarding(): OnboardingCreds | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingCreds;
    return parsed.email && parsed.senha ? parsed : null;
  } catch {
    return null;
  }
}

export function limparCredsOnboarding() {
  sessionStorage.removeItem(KEY);
}
