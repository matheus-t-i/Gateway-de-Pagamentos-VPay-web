'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Marca } from '@/components/marca';
import { Obrigatorio, TextoRotulo } from '@/components/obrigatorio';
import { api } from '@/lib/api';
import { CONTRATO_INTERMEDIACAO, TERMOS_USO, type DocumentoLegal } from '@/lib/legal';
import {
  isCnpj,
  isCpf,
  mascaraCep,
  mascaraCnpj,
  mascaraCpf,
  mascaraTelefone,
  normalizarDocumento,
} from '@/lib/documento';
import { textoSituacaoCep } from '@/lib/cep';
import { useBuscaCep } from '@/lib/use-busca-cep';
import { salvarCredsOnboarding } from '@/lib/onboarding';

const inputCls =
  'mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900';

function ModalDocumento({
  doc,
  onFechar,
}: {
  doc: DocumentoLegal;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-ink-950">
        <div className="flex items-center justify-between border-b border-ink-800/10 px-6 py-4 dark:border-white/10">
          <h2 className="font-display text-lg font-semibold">{doc.titulo}</h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded px-3 py-1 text-sm opacity-70 hover:bg-ink-800/5 dark:hover:bg-white/10"
          >
            Fechar
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 text-sm leading-relaxed">
          {doc.intro.map((p, i) => (
            <p key={i} className="mt-3">
              {p}
            </p>
          ))}
          {doc.secoes.map((s) => (
            <div key={s.titulo} className="mt-5">
              <h3 className="font-semibold">{s.titulo}</h3>
              {s.corpo.map((p, i) => (
                <p key={i} className="mt-1.5 opacity-90">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CadastroPage() {
  const router = useRouter();
  const [tipoPessoa, setTipoPessoa] = useState<'PF' | 'PJ'>('PF');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [nome, setNome] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [respCpf, setRespCpf] = useState('');
  const [respNome, setRespNome] = useState('');
  const [endereco, setEndereco] = useState({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  });
  const [faturamento, setFaturamento] = useState('');
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [aceiteContrato, setAceiteContrato] = useState(false);
  const [modal, setModal] = useState<DocumentoLegal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { situacao: situacaoCep, buscar: buscarCep } = useBuscaCep((e) => {
    setEndereco((s) => ({
      ...s,
      logradouro: e.logradouro,
      bairro: e.bairro,
      cidade: e.cidade,
      uf: e.uf,
    }));
  });
  const avisoCep = textoSituacaoCep(situacaoCep);

  const isPJ = tipoPessoa === 'PJ';

  function trocarTipo(t: 'PF' | 'PJ') {
    setTipoPessoa(t);
    setCpfCnpj(''); // máscara muda de formato
    setErro(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    const documento = normalizarDocumento(cpfCnpj);
    if (isPJ ? !isCnpj(documento) : !isCpf(documento)) {
      setErro(
        isPJ
          ? 'CNPJ inválido — 14 caracteres (o novo padrão aceita letras).'
          : 'CPF inválido — 11 dígitos.',
      );
      return;
    }
    const respDoc = normalizarDocumento(respCpf);
    if (isPJ && !isCpf(respDoc)) {
      setErro('Informe um CPF válido para o responsável pela empresa.');
      return;
    }
    if (!aceiteTermos || !aceiteContrato) {
      setErro('Marque o aceite dos dois documentos para concluir o cadastro.');
      return;
    }

    setLoading(true);
    try {
      await api('/auth/cadastro', {
        method: 'POST',
        body: JSON.stringify({
          tipoPessoa,
          cpfCnpj: documento,
          nomeRazaoSocial: nome,
          nomeFantasia: nomeFantasia || undefined,
          email,
          telefone: telefone.replace(/\D/g, '') || undefined,
          senha,
          responsavel: isPJ ? { cpf: respDoc, nome: respNome } : undefined,
          endereco: {
            cep: endereco.cep.replace(/\D/g, ''),
            logradouro: endereco.logradouro,
            numero: endereco.numero,
            complemento: endereco.complemento || undefined,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            uf: endereco.uf.toUpperCase(),
          },
          faturamentoMensalMedio: faturamento.replace(/\./g, '').replace(',', '.'),
          aceites: { termosUso: true, contratoIntermediacao: true },
        }),
      });
      salvarCredsOnboarding({ email, senha });
      router.push('/onboarding/documentos');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no cadastro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10 sm:px-6">
      <Marca href="/login" prioridade />
      <h1 className="mt-3 font-display text-3xl font-semibold">Criar conta</h1>
      <p className="mt-2 text-sm opacity-70">
        Preencha seus dados. Depois do cadastro você envia a documentação para
        análise.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['PF', 'PJ'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => trocarTipo(t)}
              className={`rounded-md border px-4 py-2 text-sm transition ${
                tipoPessoa === t
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-ink-800/15 hover:bg-ink-800/5 dark:border-white/10 dark:hover:bg-white/5'
              }`}
            >
              {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <TextoRotulo obrigatorio>{isPJ ? 'CNPJ' : 'CPF'}</TextoRotulo>
            <input
              className={inputCls}
              value={cpfCnpj}
              onChange={(e) =>
                setCpfCnpj(isPJ ? mascaraCnpj(e.target.value) : mascaraCpf(e.target.value))
              }
              placeholder={isPJ ? '00.000.000/0000-00' : '000.000.000-00'}
              inputMode={isPJ ? 'text' : 'numeric'}
              autoComplete="off"
              required
            />
          </label>
          <label className="block text-sm">
            Telefone
            <input
              className={inputCls}
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
            />
          </label>
        </div>

        <label className="block text-sm">
          <TextoRotulo obrigatorio>{isPJ ? 'Razão social' : 'Nome completo'}</TextoRotulo>
          <input
            className={inputCls}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            minLength={2}
          />
        </label>

        {isPJ && (
          <label className="block text-sm">
            Nome fantasia (opcional)
            <input
              className={inputCls}
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
            />
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <TextoRotulo obrigatorio>E-mail</TextoRotulo>
            <input
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Senha</TextoRotulo>
            <input
              className={inputCls}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              type="password"
              required
              minLength={8}
            />
          </label>
        </div>

        {/* Responsável — obrigatório para PJ */}
        {isPJ && (
          <div className="rounded-lg border border-ink-800/10 p-4 dark:border-white/10">
            <h2 className="text-sm font-semibold">Responsável pela empresa</h2>
            <p className="mt-1 text-xs opacity-70">
              Toda empresa tem uma pessoa física responsável. Os documentos
              pessoais (RG/CNH e selfie) enviados na próxima etapa devem ser
              desta pessoa.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <TextoRotulo obrigatorio>CPF do responsável</TextoRotulo>
                <input
                  className={inputCls}
                  value={respCpf}
                  onChange={(e) => setRespCpf(mascaraCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  required={isPJ}
                />
              </label>
              <label className="block text-sm">
                <TextoRotulo obrigatorio>Nome do responsável</TextoRotulo>
                <input
                  className={inputCls}
                  value={respNome}
                  onChange={(e) => setRespNome(e.target.value)}
                  required={isPJ}
                  minLength={2}
                />
              </label>
            </div>
          </div>
        )}

        {/* Endereço completo + faturamento */}
        <div className="rounded-lg border border-ink-800/10 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold">Endereço completo</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <TextoRotulo obrigatorio>CEP</TextoRotulo>
              <input
                className={inputCls}
                value={endereco.cep}
                onChange={(e) => {
                  const cep = mascaraCep(e.target.value);
                  setEndereco((s) => ({ ...s, cep }));
                  buscarCep(cep);
                }}
                placeholder="00000-000"
                inputMode="numeric"
                required
                autoComplete="postal-code"
              />
              {avisoCep && (
                <span className="mt-1 block text-xs opacity-60">{avisoCep}</span>
              )}
            </label>
            <label className="block text-sm sm:col-span-2">
              <TextoRotulo obrigatorio>Logradouro</TextoRotulo>
              <input
                className={inputCls}
                value={endereco.logradouro}
                onChange={(e) =>
                  setEndereco((s) => ({ ...s, logradouro: e.target.value }))
                }
                required
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <TextoRotulo obrigatorio>Número</TextoRotulo>
              <input
                className={inputCls}
                value={endereco.numero}
                onChange={(e) => setEndereco((s) => ({ ...s, numero: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              Complemento (opcional)
              <input
                className={inputCls}
                value={endereco.complemento}
                onChange={(e) =>
                  setEndereco((s) => ({ ...s, complemento: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <TextoRotulo obrigatorio>Bairro</TextoRotulo>
              <input
                className={inputCls}
                value={endereco.bairro}
                onChange={(e) => setEndereco((s) => ({ ...s, bairro: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm">
              <TextoRotulo obrigatorio>Cidade</TextoRotulo>
              <input
                className={inputCls}
                value={endereco.cidade}
                onChange={(e) => setEndereco((s) => ({ ...s, cidade: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm">
              <TextoRotulo obrigatorio>UF</TextoRotulo>
              <input
                className={inputCls}
                value={endereco.uf}
                onChange={(e) =>
                  setEndereco((s) => ({ ...s, uf: e.target.value.toUpperCase() }))
                }
                required
                maxLength={2}
                placeholder="SP"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm">
            <TextoRotulo obrigatorio>Média de faturamento mensal (R$)</TextoRotulo>
            <input
              className={inputCls}
              value={faturamento}
              onChange={(e) => setFaturamento(e.target.value)}
              required
              inputMode="decimal"
              placeholder="25000.00"
            />
          </label>
        </div>

        {/* Documentos legais */}
        <div className="rounded-lg border border-ink-800/10 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold">Documentos legais</h2>
          <p className="mt-1 text-xs opacity-70">
            Ao criar a conta, registramos seu IP (e localização, se autorizada no
            app mobile) para assinatura digital dos documentos abaixo.
          </p>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={aceiteTermos}
              onChange={(e) => setAceiteTermos(e.target.checked)}
            />
            <span>
              Li e aceito{' '}
              <button
                type="button"
                onClick={() => setModal(TERMOS_USO)}
                className="font-medium text-accent hover:underline"
              >
                Termos de Uso e Política de Privacidade
              </button>
              <Obrigatorio />
            </span>
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={aceiteContrato}
              onChange={(e) => setAceiteContrato(e.target.checked)}
            />
            <span>
              Li e aceito{' '}
              <button
                type="button"
                onClick={() => setModal(CONTRATO_INTERMEDIACAO)}
                className="font-medium text-accent hover:underline"
              >
                Contrato de Intermediação de Pagamentos
              </button>
              <Obrigatorio />
            </span>
          </label>
          {!(aceiteTermos && aceiteContrato) && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              Marque o aceite dos dois documentos para concluir o cadastro.
            </p>
          )}
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={loading || !aceiteTermos || !aceiteContrato}
          className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Criando conta…' : 'Criar conta e enviar documentos'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm opacity-80">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Acessar
        </Link>
      </p>

      {modal && <ModalDocumento doc={modal} onFechar={() => setModal(null)} />}
    </main>
  );
}
