'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { CampoMoeda, Selecao } from '@/components/campos';
import { ModalAcoes } from '@/components/modal';
import { Obrigatorio } from '@/components/obrigatorio';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { textoSituacaoCep } from '@/lib/cep';
import {
  formatarDocumento,
  mascaraCep,
  mascaraCpf,
  mascaraDocumento,
  mascaraTelefone,
} from '@/lib/documento';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';
import { useBuscaCep } from '@/lib/use-busca-cep';
import { Bloco, campo, erroMsg } from './painel-operacional';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const;

type Endereco = {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

export type FichaCadastral = {
  tipoPessoa: 'PF' | 'PJ';
  cpfCnpj: string;
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  email: string;
  telefone: string | null;
  responsavel: { nome: string | null; cpf: string | null };
  endereco: Endereco | null;
  faturamentoMensalMedio: string | null;
};

function rotulo(
  texto: string,
  opts?: { extra?: string; obrigatorio?: boolean },
) {
  return (
    <span className="block text-xs font-medium opacity-70">
      {texto}
      {opts?.obrigatorio ? <Obrigatorio /> : null}
      {opts?.extra && (
        <span className="ml-1 font-normal opacity-50">{opts.extra}</span>
      )}
    </span>
  );
}

export function FormularioDadosCadastrais({
  idPublico,
  ficha,
  token,
  onSalvo,
}: {
  idPublico: string;
  ficha: FichaCadastral;
  token: string;
  onSalvo: () => void;
}) {
  const { pode } = useAuth();
  const podeEditar = pode(PERMISSOES.ADMIN_USUARIOS_EDITAR);
  const [tipoPessoa, setTipoPessoa] = useState<'PF' | 'PJ'>(ficha.tipoPessoa);
  const [cpfCnpj, setCpfCnpj] = useState(() => formatarDocumento(ficha.cpfCnpj));
  const [nome, setNome] = useState(ficha.nomeRazaoSocial);
  const [nomeFantasia, setNomeFantasia] = useState(ficha.nomeFantasia ?? '');
  const [telefone, setTelefone] = useState(
    ficha.telefone ? mascaraTelefone(ficha.telefone) : '',
  );
  const [faturamento, setFaturamento] = useState(
    ficha.faturamentoMensalMedio ?? '0',
  );
  const [respNome, setRespNome] = useState(ficha.responsavel.nome ?? '');
  const [respCpf, setRespCpf] = useState(
    ficha.responsavel.cpf ? mascaraCpf(ficha.responsavel.cpf) : '',
  );
  const [end, setEnd] = useState<Required<Endereco>>({
    cep: ficha.endereco?.cep ? mascaraCep(ficha.endereco.cep) : '',
    logradouro: ficha.endereco?.logradouro ?? '',
    numero: ficha.endereco?.numero ?? '',
    complemento: ficha.endereco?.complemento ?? '',
    bairro: ficha.endereco?.bairro ?? '',
    cidade: ficha.endereco?.cidade ?? '',
    uf: (ficha.endereco?.uf ?? '').toUpperCase(),
  });
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const { situacao: situacaoCep, buscar: buscarCep } = useBuscaCep((e) => {
    setEnd((s) => ({
      ...s,
      logradouro: e.logradouro,
      bairro: e.bairro,
      cidade: e.cidade,
      uf: e.uf,
    }));
  });
  const avisoCep = textoSituacaoCep(situacaoCep);

  useEffect(() => {
    setTipoPessoa(ficha.tipoPessoa);
    setCpfCnpj(formatarDocumento(ficha.cpfCnpj));
    setNome(ficha.nomeRazaoSocial);
    setNomeFantasia(ficha.nomeFantasia ?? '');
    setTelefone(ficha.telefone ? mascaraTelefone(ficha.telefone) : '');
    setFaturamento(ficha.faturamentoMensalMedio ?? '0');
    setRespNome(ficha.responsavel.nome ?? '');
    setRespCpf(ficha.responsavel.cpf ? mascaraCpf(ficha.responsavel.cpf) : '');
    setEnd({
      cep: ficha.endereco?.cep ? mascaraCep(ficha.endereco.cep) : '',
      logradouro: ficha.endereco?.logradouro ?? '',
      numero: ficha.endereco?.numero ?? '',
      complemento: ficha.endereco?.complemento ?? '',
      bairro: ficha.endereco?.bairro ?? '',
      cidade: ficha.endereco?.cidade ?? '',
      uf: (ficha.endereco?.uf ?? '').toUpperCase(),
    });
  }, [ficha]);

  const pj = tipoPessoa === 'PJ';

  const restaurar = () => {
    setOk(false);
    setErro(null);
    setTipoPessoa(ficha.tipoPessoa);
    setCpfCnpj(formatarDocumento(ficha.cpfCnpj));
    setNome(ficha.nomeRazaoSocial);
    setNomeFantasia(ficha.nomeFantasia ?? '');
    setTelefone(ficha.telefone ? mascaraTelefone(ficha.telefone) : '');
    setFaturamento(ficha.faturamentoMensalMedio ?? '0');
    setRespNome(ficha.responsavel.nome ?? '');
    setRespCpf(ficha.responsavel.cpf ? mascaraCpf(ficha.responsavel.cpf) : '');
    setEnd({
      cep: ficha.endereco?.cep ? mascaraCep(ficha.endereco.cep) : '',
      logradouro: ficha.endereco?.logradouro ?? '',
      numero: ficha.endereco?.numero ?? '',
      complemento: ficha.endereco?.complemento ?? '',
      bairro: ficha.endereco?.bairro ?? '',
      cidade: ficha.endereco?.cidade ?? '',
      uf: (ficha.endereco?.uf ?? '').toUpperCase(),
    });
  };

  const salvar = useMutation({
    mutationFn: (codigoTotp: string) =>
      api(`/admin/usuarios/${idPublico}/dados-cadastrais`, {
        token,
        method: 'PUT',
        body: JSON.stringify({
          tipoPessoa,
          cpfCnpj,
          nomeRazaoSocial: nome,
          nomeFantasia: nomeFantasia.trim() || null,
          telefone: telefone.replace(/\D/g, '') || null,
          faturamentoMensalMedio:
            faturamento && Number(faturamento) > 0 ? faturamento : null,
          responsavel: pj
            ? { cpf: respCpf, nome: respNome }
            : undefined,
          endereco: {
            cep: end.cep.replace(/\D/g, ''),
            logradouro: end.logradouro,
            numero: end.numero,
            complemento: end.complemento.trim() || undefined,
            bairro: end.bairro,
            cidade: end.cidade,
            uf: end.uf,
          },
          codigoTotp,
        }),
      }),
    onSuccess: () => {
      setErro(null);
      setOk(true);
      onSalvo();
    },
    onError: (e) => {
      setOk(false);
      setErro(erroMsg(e));
    },
  });

  const travado = !podeEditar;
  const grade =
    'grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6 lg:grid-cols-12';

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (travado) return;
        const codigoTotp = await pedirCodigoTotp(
          'Confirme a correção cadastral com o código da sua conta admin:',
        );
        if (!codigoTotp) return;
        salvar.mutate(codigoTotp);
      }}
    >
      <Bloco
        icone={UserRound}
        titulo="Dados pessoais e endereço"
        descricao="Corrija o cadastro. E-mail é o login e não muda."
      >
        <div className="space-y-3">
        <div className={grade}>
          <Selecao
            label="Tipo"
            obrigatorio
            ajuda="Trocar PF/PJ altera os documentos obrigatórios — revise a seção de documentos depois."
            value={tipoPessoa}
            onChange={(v) => setTipoPessoa(v as 'PF' | 'PJ')}
            disabled={travado}
            className="!max-w-none sm:col-span-2 lg:col-span-2"
          >
            <option value="PF">Pessoa física</option>
            <option value="PJ">Pessoa jurídica</option>
          </Selecao>
          <label className="block min-w-0 sm:col-span-4 lg:col-span-3">
            {rotulo(pj ? 'CNPJ' : 'CPF', { obrigatorio: true })}
            <input
              className={campo}
              value={cpfCnpj}
              onChange={(e) =>
                setCpfCnpj(mascaraDocumento(tipoPessoa, e.target.value))
              }
              disabled={travado}
              autoComplete="off"
              required
            />
          </label>
          <label className="block min-w-0 sm:col-span-4 lg:col-span-5">
            {rotulo(pj ? 'Razão social' : 'Nome completo', { obrigatorio: true })}
            <input
              className={campo}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={travado}
              minLength={2}
              required
            />
          </label>
          <label className="block min-w-0 sm:col-span-2 lg:col-span-2">
            {rotulo('Nome fantasia')}
            <input
              className={campo}
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              disabled={travado}
            />
          </label>
          <label className="block min-w-0 sm:col-span-4 lg:col-span-5">
            {rotulo('E-mail', { extra: 'não altera' })}
            <input
              className={campo}
              value={ficha.email}
              disabled
              readOnly
              title="Identificador único da conta — não pode ser alterado."
            />
          </label>
          <label className="block min-w-0 sm:col-span-2 lg:col-span-3">
            {rotulo('Telefone')}
            <input
              className={campo}
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
              disabled={travado}
              inputMode="numeric"
              placeholder="(00) 00000-0000"
            />
          </label>
          <CampoMoeda
            label="Faturamento médio"
            ajuda="Média declarada no cadastro. Não entra no cálculo de taxa nem de reserva."
            valor={faturamento}
            onChange={setFaturamento}
            disabled={travado}
            className="!max-w-none sm:col-span-6 lg:col-span-4"
          />
          {pj && (
            <>
              <label className="block min-w-0 sm:col-span-4 lg:col-span-7">
                {rotulo('Responsável', { obrigatorio: true })}
                <input
                  className={campo}
                  value={respNome}
                  onChange={(e) => setRespNome(e.target.value)}
                  disabled={travado}
                  minLength={2}
                  required={pj}
                />
              </label>
              <label className="block min-w-0 sm:col-span-2 lg:col-span-5">
                {rotulo('CPF do responsável', { obrigatorio: true })}
                <input
                  className={campo}
                  value={respCpf}
                  onChange={(e) => setRespCpf(mascaraCpf(e.target.value))}
                  disabled={travado}
                  inputMode="numeric"
                  required={pj}
                />
              </label>
            </>
          )}
        </div>

        <p className="border-t border-ink-800/10 pt-3 text-[11px] font-semibold uppercase tracking-wide opacity-50 dark:border-white/10">
          Endereço
        </p>

        <div className={grade}>
          <label className="block min-w-0 sm:col-span-2 lg:col-span-2">
            {rotulo('CEP', { obrigatorio: true })}
            <input
              className={campo}
              value={end.cep}
              onChange={(e) => {
                const cep = mascaraCep(e.target.value);
                setEnd((s) => ({ ...s, cep }));
                if (!travado) buscarCep(cep);
              }}
              disabled={travado}
              inputMode="numeric"
              placeholder="00000-000"
              required
              autoComplete="postal-code"
            />
            {avisoCep && (
              <span className="mt-1 block text-[11px] leading-snug opacity-55">
                {avisoCep}
              </span>
            )}
          </label>
          <label className="block min-w-0 sm:col-span-4 lg:col-span-6">
            {rotulo('Logradouro', { obrigatorio: true })}
            <input
              className={campo}
              value={end.logradouro}
              onChange={(e) =>
                setEnd((s) => ({ ...s, logradouro: e.target.value }))
              }
              disabled={travado}
              required
            />
          </label>
          <label className="block min-w-0 sm:col-span-2 lg:col-span-2">
            {rotulo('Nº', { obrigatorio: true })}
            <input
              className={campo}
              value={end.numero}
              onChange={(e) => setEnd((s) => ({ ...s, numero: e.target.value }))}
              disabled={travado}
              required
            />
          </label>
          <label className="block min-w-0 sm:col-span-2 lg:col-span-2">
            {rotulo('Complemento')}
            <input
              className={campo}
              value={end.complemento}
              onChange={(e) =>
                setEnd((s) => ({ ...s, complemento: e.target.value }))
              }
              disabled={travado}
            />
          </label>
          <label className="block min-w-0 sm:col-span-2 lg:col-span-3">
            {rotulo('Bairro', { obrigatorio: true })}
            <input
              className={campo}
              value={end.bairro}
              onChange={(e) => setEnd((s) => ({ ...s, bairro: e.target.value }))}
              disabled={travado}
              required
            />
          </label>
          <label className="block min-w-0 sm:col-span-4 lg:col-span-7">
            {rotulo('Cidade', { obrigatorio: true })}
            <input
              className={campo}
              value={end.cidade}
              onChange={(e) => setEnd((s) => ({ ...s, cidade: e.target.value }))}
              disabled={travado}
              required
            />
          </label>
          <label className="block min-w-0 sm:col-span-2 lg:col-span-2">
            {rotulo('UF', { obrigatorio: true })}
            <select
              className={campo}
              value={end.uf}
              onChange={(e) =>
                setEnd((s) => ({ ...s, uf: e.target.value.toUpperCase() }))
              }
              disabled={travado}
              required
            >
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        </div>
        </div>

        {erro && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {erro}
          </p>
        )}
        {ok && !salvar.isPending && (
          <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            Dados cadastrais atualizados.
          </p>
        )}
        {!podeEditar ? (
          <p className="mt-3 text-sm opacity-60">
            Seu perfil de acesso permite consultar, mas não alterar estes dados.
          </p>
        ) : (
          <div className="mt-3">
            <ModalAcoes
              onCancelar={restaurar}
              rotulo="Salvar"
              pendente={salvar.isPending}
            />
          </div>
        )}
      </Bloco>
    </form>
  );
}
