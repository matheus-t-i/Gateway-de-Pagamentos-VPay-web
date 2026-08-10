/** Reexport estável — call sites importam daqui sem puxar o host React. */
export {
  MSG_TOTP_OBRIGATORIO,
  ROTA_ATIVAR_2FA,
  avisarTotpObrigatorioSeAplicavel,
  ehErroTotpObrigatorio,
  pedirCodigoTotp,
} from './step-up-totp-bridge';
