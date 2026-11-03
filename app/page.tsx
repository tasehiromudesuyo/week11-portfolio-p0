'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Check, ChevronLeft, ChevronRight, FileText, HeartHandshake, LockKeyhole, LogOut, Paperclip, Search, ShieldCheck, X } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

type View = 'contact' | 'insurance' | 'admin'
type Status = 'pending' | 'in_progress' | 'completed'

type Inquiry = {
  id: string
  name: string
  email: string
  phone: string
  type: string
  part: string
  details: string
  file: string | null
  status: Status
  createdAt: string
}

const initialForm = { name: '', email: '', phone: '', type: '', part: '', details: '', consent: false }

export default function Page() {
  const [view, setView] = useState<View>('contact')
  const [step, setStep] = useState<'form' | 'confirm' | 'complete'>('form')
  const [form, setForm] = useState(initialForm)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [isLoadingInquiries, setIsLoadingInquiries] = useState(false)
  const [dataError, setDataError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoginError, setAdminLoginError] = useState('')

  // Supabaseから問い合わせ一覧を取得
  useEffect(() => {
    async function loadInquiries() {
      setIsLoadingInquiries(true)
      const { data, error } = await supabase
        .from('inquiries')
        .select('id, name, email, phone, inquiry_type, message, status, created_at')
        .order('created_at', { ascending: false })
      
      if (error) {
        setDataError('お問い合わせ一覧を取得できませんでした。')
      } else {
        setInquiries(
          (data ?? []).map((item) => {
            // メッセージから「対象部位・種類」と「ご相談内容」を復元するパース処理
            const messageParts = item.message.split('\n\n【ご相談内容】\n')
            const partLine = messageParts[0]?.replace('【対象部位・種類】\n', '') || ''
            const detailsText = messageParts[1] || item.message

            return {
              id: item.id,
              name: item.name,
              email: item.email,
              phone: item.phone ?? '',
              type: item.inquiry_type,
              part: partLine,
              details: detailsText,
              file: null,
              status: item.status === '対応中' ? 'in_progress' : item.status === '完了' ? 'completed' : 'pending',
              createdAt: new Date(item.created_at).toLocaleString('ja-JP'),
            }
          })
        )
      }
      setIsLoadingInquiries(false)
    }
    loadInquiries()
  }, [])

  const filtered = useMemo(() => inquiries.filter((item) => {
    const matchesQuery = `${item.name} ${item.id} ${item.part}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (statusFilter === 'all' || item.status === statusFilter)
  }), [inquiries, query, statusFilter])

  function update(key: keyof typeof initialForm, value: string | boolean) { 
    setForm((current) => ({ ...current, [key]: value }))
    setError('') 
  }

  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name || !form.email || !form.type || !form.part || !form.details || !form.consent) { 
      setError('必須項目を入力し、個人情報保護方針に同意してください。')
      return 
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) { 
      setError('メールアドレスの形式をご確認ください。')
      return 
    }
    if (form.phone && !/^[0-9０-９+\-()（）\s]+$/.test(form.phone)) { 
      setError('電話番号の形式をご確認ください。')
      return 
    }
    if (file && file.size > 10 * 1024 * 1024) { 
      setError('添付ファイルは10MB以内にしてください。')
      return 
    }
    setStep('confirm')
  }

  // Supabaseへ実際にデータを挿入する処理
  async function submitToSupabase() {
    const { data, error } = await supabase
      .from('inquiries')
      .insert({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        inquiry_type: form.type,
        message: `【対象部位・種類】\n${form.part}\n\n【ご相談内容】\n${form.details}`,
        status: '未対応',
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('Supabase Error:', error)
      setError('お問い合わせを送信できませんでした。時間をおいて再度お試しください。')
      return
    }

    setInquiries((items) => [
      {
        id: data.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        type: form.type,
        part: form.part,
        details: form.details,
        file: file?.name ?? null,
        status: 'pending',
        createdAt: new Date(data.created_at).toLocaleString('ja-JP'),
      },
      ...items,
    ])
    setStep('complete')
  }

  async function updateStatus(status: Status) {
    if (!selected) return
    const statusValue = status === 'in_progress' ? '対応中' : status === 'completed' ? '完了' : '未対応'
    const { error } = await supabase
      .from('inquiries')
      .update({ status: statusValue, updated_at: new Date().toISOString() })
      .eq('id', selected.id)

    if (error) {
      setDataError('ステータスを更新できませんでした。')
      return
    }
    setInquiries((items) => items.map((item) => item.id === selected.id ? { ...item, status } : item))
    setSelected({ ...selected, status })
  }

  function loginAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (adminId === 'demo-admin' && adminPassword === 'demo1234') {
      setAdminAuthenticated(true)
      setAdminLoginError('')
      return
    }
    setAdminLoginError('社内IDまたはパスワードが正しくありません。')
  }

  const statusLabel: Record<Status, string> = { pending: '未対応', in_progress: '対応中', completed: '完了' }

  return (
    <main className="min-h-screen bg-[#f7fafc] text-[#333]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <button onClick={() => setView('contact')} className="flex items-center gap-3 text-left">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[#2878b8] text-white"><HeartHandshake /></span>
            <span><strong className="block text-lg tracking-wide text-[#174c74]">あおぞら義肢装具</strong><small className="text-xs text-[#777]">いつでも、安心してご相談ください</small></span>
          </button>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <button onClick={() => setView('insurance')} className={`rounded-lg px-3 py-2 ${view === 'insurance' ? 'bg-[#eaf3fa] text-[#2878b8]' : 'text-[#567]'}`}>健康保険について</button>
            <button onClick={() => setView('admin')} className={`rounded-lg px-3 py-2 ${view === 'admin' ? 'bg-[#eaf3fa] text-[#2878b8]' : 'text-[#567]'}`}>管理者画面</button>
          </nav>
        </div>
      </header>

      {view === 'contact' && (
        <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-14">
          <div className="mb-9 flex items-center justify-center gap-3 text-xs font-semibold sm:gap-5 sm:text-sm">
            {['入力', '確認', '完了'].map((label, index) => { 
              const current = step === 'form' ? 0 : step === 'confirm' ? 1 : 2
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className={`flex size-8 items-center justify-center rounded-full ${index <= current ? 'bg-[#2878b8] text-white' : 'bg-[#e5edf3] text-[#789]'}`}>{index < current ? <Check /> : index + 1}</span>
                  <span className={index <= current ? 'text-[#2878b8]' : 'text-[#8a9aa8]'}>{label}</span>
                  {index < 2 && <span className="h-px w-8 bg-[#d8e4ec] sm:w-16" />}
                </div>
              ) 
            })}
          </div>

          {step === 'form' && (
            <section className="mx-auto max-w-2xl rounded-2xl border border-[#e4edf3] bg-white p-6 shadow-sm sm:p-10">
              <p className="mb-2 text-sm font-bold text-[#2878b8]">CONTACT FORM</p>
              <h1 className="text-2xl font-bold text-[#174c74] sm:text-3xl">お問い合わせ</h1>
              <p className="mt-3 text-sm leading-7 text-[#777]">義肢装具に関するご相談を、24時間いつでも受け付けています。内容を確認のうえ、担当者よりご連絡いたします。</p>
              <form onSubmit={review} className="mt-8 flex flex-col gap-6">
                <Field label="お名前" required><input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="例：山田 太郎" /></Field>
                <Field label="メールアドレス" required><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="例：info@example.jp" /></Field>
                <Field label="電話番号" hint="日中ご連絡のつきやすい番号"><input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="例：090-0000-0000" /></Field>
                <Field label="相談区分" required>
                  <select value={form.type} onChange={(e) => update('type', e.target.value)}>
                    <option value="">選択してください</option>
                    <option>新しく作りたい</option>
                    <option>調整・修理について</option>
                    <option>書類・保険について</option>
                    <option>その他</option>
                  </select>
                </Field>
                <Field label="対象部位・種類" required>
                  <select value={form.part} onChange={(e) => update('part', e.target.value)}>
                    <option value="">選択してください</option>
                    <option>義足</option>
                    <option>義手</option>
                    <option>装具（足・膝・腰など）</option>
                    <option>その他</option>
                  </select>
                </Field>
                <Field label="相談内容詳細" required hint="症状やお困りのことをできるだけ詳しくご記入ください">
                  <textarea rows={5} value={form.details} onChange={(e) => update('details', e.target.value)} placeholder="ご相談内容をご入力ください" />
                </Field>
                <Field label="写真・処方箋ファイル" hint="JPG / PNG / PDF（10MBまで）">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#b9d1e1] bg-[#f7fbfd] px-4 py-4 text-sm text-[#567]">
                    <Paperclip className="text-[#2878b8]" />
                    <span>{file ? file.name : 'ファイルを選択してください'}</span>
                    <input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                </Field>
                <label className="flex items-start gap-3 text-sm leading-6 text-[#555]">
                  <input className="mt-1 size-4 accent-[#2878b8]" type="checkbox" checked={form.consent} onChange={(e) => update('consent', e.target.checked)} />
                  <span><a href="#privacy" className="font-semibold text-[#2878b8] underline">個人情報保護方針</a>に同意する <b className="ml-1 rounded bg-[#fff1e6] px-2 py-1 text-xs font-semibold text-[#c87534]">必須</b></span>
                </label>
                {error && <p className="rounded-lg bg-[#fff3f1] px-4 py-3 text-sm text-[#c24b3d]" role="alert">{error}</p>}
                <button className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[#2878b8] px-6 text-base font-bold text-white hover:bg-[#1f679f]" type="submit">確認画面へ進む <ChevronRight /></button>
              </form>
            </section>
          )}

          {step === 'confirm' && (
            <section className="mx-auto max-w-2xl rounded-2xl border border-[#e4edf3] bg-white p-6 shadow-sm sm:p-10">
              <p className="mb-2 text-sm font-bold text-[#2878b8]">PLEASE CHECK</p>
              <h1 className="text-2xl font-bold text-[#174c74]">お問い合わせ内容の確認</h1>
              <div className="mt-8 overflow-hidden rounded-xl border border-[#e5e7eb]">
                {[
                  ['お名前', form.name], 
                  ['メールアドレス', form.email], 
                  ['電話番号', form.phone || '未入力'], 
                  ['相談区分', form.type], 
                  ['対象部位・種類', form.part], 
                  ['相談内容', form.details], 
                  ['添付ファイル', file?.name || 'なし']
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-2 border-b border-[#edf0f2] px-4 py-4 last:border-0 sm:grid-cols-[150px_1fr]">
                    <dt className="text-sm font-semibold text-[#777]">{label}</dt>
                    <dd className="whitespace-pre-wrap text-sm leading-6">{value}</dd>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button onClick={() => setStep('form')} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#b9d1e1] px-6 font-semibold text-[#2878b8]"><ChevronLeft />戻って修正する</button>
                <button onClick={submitToSupabase} className="min-h-12 rounded-lg bg-[#2878b8] px-8 font-bold text-white">入力・送信</button>
              </div>
            </section>
          )}

          {step === 'complete' && (
            <section className="mx-auto max-w-2xl rounded-2xl border border-[#e4edf3] bg-white px-6 py-14 text-center shadow-sm sm:px-10">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[#e7f6ee] text-[#2c9a63]"><Check className="size-10" /></div>
              <h1 className="mt-7 text-2xl font-bold text-[#174c74]">お問い合わせを受け付けました</h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#666]">内容を確認のうえ、担当者よりご連絡いたします。お問い合わせありがとうございました。</p>
              <button onClick={() => { setForm(initialForm); setFile(null); setStep('form') }} className="mt-9 min-h-12 rounded-lg bg-[#2878b8] px-10 font-bold text-white">トップへ戻る</button>
            </section>
          )}

          <InfoCard onClick={() => setView('insurance')} />
        </div>
      )}

      {view === 'insurance' && (
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
          <section className="rounded-2xl border border-[#e4edf3] bg-white p-7 shadow-sm sm:p-10">
            <ShieldCheck className="text-[#2878b8]" />
            <h1 className="mt-5 text-3xl font-bold text-[#174c74]">健康保険について</h1>
            <p className="mt-4 text-sm leading-7 text-[#666]">義肢装具に関する健康保険のご案内を、保険の種類ごとにご確認いただけます。具体的な適用条件や給付内容は、担当窓口へご確認ください。</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {['健康保険（協会けんぽ）','国民健康保険','後期高齢者医療制度','その他の公的制度'].map((name) => (
                <button key={name} className="flex items-center justify-between rounded-xl border border-[#d9e6ef] p-5 text-left font-bold text-[#174c74] hover:border-[#2878b8] hover:bg-[#f7fbfd]">
                  {name}<ChevronRight className="text-[#2878b8]" />
                </button>
              ))}
            </div>
            <button onClick={() => setView('contact')} className="mt-9 flex items-center gap-2 font-bold text-[#2878b8]"><ChevronLeft />お問い合わせへ戻る</button>
          </section>
        </div>
      )}

      {view === 'admin' && (!adminAuthenticated ? (
        <div className="mx-auto max-w-md px-5 py-14 sm:px-8">
          <section className="rounded-2xl border border-[#e4edf3] bg-white p-7 shadow-sm sm:p-10">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#eaf3fa] text-[#2878b8]"><LockKeyhole /></div>
            <p className="mt-6 text-center text-sm font-bold text-[#2878b8]">ADMIN SIGN IN</p>
            <h1 className="mt-2 text-center text-2xl font-bold text-[#174c74]">管理者ログイン</h1>
            <p className="mt-3 text-center text-sm leading-6 text-[#777]">社内IDとパスワードを入力して管理画面へアクセスしてください。</p>
            <form onSubmit={loginAdmin} className="mt-8 flex flex-col gap-5">
              <Field label="社内ID" required><input value={adminId} onChange={(e) => { setAdminId(e.target.value); setAdminLoginError('') }} autoComplete="username" placeholder="社内IDを入力" /></Field>
              <Field label="パスワード" required><input type="password" value={adminPassword} onChange={(e) => { setAdminPassword(e.target.value); setAdminLoginError('') }} autoComplete="current-password" placeholder="パスワードを入力" /></Field>
              {adminLoginError && <p role="alert" className="rounded-lg bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#b54848]">{adminLoginError}</p>}
              <button type="submit" className="min-h-12 rounded-lg bg-[#2878b8] px-6 font-bold text-white hover:bg-[#20699f]">管理画面にログイン</button>
            </form>
            <button onClick={() => setView('contact')} className="mt-6 w-full text-sm font-bold text-[#2878b8]">お問い合わせ画面へ戻る</button>
          </section>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#2878b8]">ADMIN CONSOLE</p>
              <h1 className="mt-1 text-3xl font-bold text-[#174c74]">お問い合わせ管理</h1>
              <p className="mt-2 text-sm text-[#777]">受信したお問い合わせを確認・管理できます。</p>
            </div>
            <button onClick={() => setView('contact')} className="flex items-center gap-2 rounded-lg border border-[#d9e6ef] bg-white px-4 py-2 text-sm font-semibold text-[#567]"><LogOut />ログアウト</button>
          </div>
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#e4edf3] bg-white p-4 sm:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-[#d9e6ef] px-3">
              <Search className="text-[#8ba0ae]" />
              <input className="border-0 py-3 outline-none" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="名前・ID・部位で検索" />
            </label>
            <select className="rounded-lg border border-[#d9e6ef] px-3 py-3" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">すべてのステータス</option>
              <option value="pending">未対応</option>
              <option value="in_progress">対応中</option>
              <option value="completed">完了</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#e4edf3] bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-[#f5f9fc] text-xs text-[#777]">
                <tr>
                  <th className="px-5 py-4">ID</th>
                  <th className="px-5 py-4">お名前</th>
                  <th className="px-5 py-4">部位</th>
                  <th className="px-5 py-4">ステータス</th>
                  <th className="px-5 py-4">受付日時</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} onClick={() => setSelected(item)} className="cursor-pointer border-t border-[#edf0f2] hover:bg-[#f7fbfd]">
                    <td className="px-5 py-4 font-semibold text-[#2878b8]">{item.id}</td>
                    <td className="px-5 py-4 font-bold text-[#333]">{item.name}</td>
                    <td className="px-5 py-4">{item.part}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === 'pending' ? 'bg-[#fff1e6] text-[#c87534]' : item.status === 'in_progress' ? 'bg-[#eaf3fa] text-[#2878b8]' : 'bg-[#e7f6ee] text-[#2c9a63]'}`}>
                        {statusLabel[item.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#777]">{item.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {selected && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-[#174c74]/30 p-4" onClick={() => setSelected(null)}>
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-[#2878b8]">{selected.id}</p>
                <h2 className="mt-1 text-2xl font-bold text-[#174c74]">お問い合わせ詳細</h2>
              </div>
              <button onClick={() => setSelected(null)} aria-label="閉じる" className="rounded-lg p-2 text-[#789] hover:bg-[#f5f9fc]"><X /></button>
            </div>
            <dl className="mt-7 grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="お名前" value={selected.name} />
              <Detail label="メールアドレス" value={selected.email} />
              <Detail label="電話番号" value={selected.phone || '未入力'} />
              <Detail label="相談区分" value={selected.type} />
              <Detail label="対象部位・種類" value={selected.part} />
              <Detail label="受付日時" value={selected.createdAt} />
              <div className="sm:col-span-2">
                <dt className="font-bold text-[#777]">相談内容</dt>
                <dd className="mt-2 rounded-lg bg-[#f7fafc] p-4 leading-7">{selected.details}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-bold text-[#777]">添付ファイル</dt>
                <dd className="mt-2 flex items-center gap-2 text-[#2878b8]">{selected.file ? <><FileText />{selected.file}</> : '添付ファイルなし'}</dd>
              </div>
            </dl>
            <div className="mt-7 flex flex-col gap-3 border-t border-[#edf0f2] pt-6 sm:flex-row sm:items-end">
              <Field label="現在のステータス">
                <select value={selected.status} onChange={(e) => updateStatus(e.target.value as Status)}>
                  <option value="pending">未対応</option>
                  <option value="in_progress">対応中</option>
                  <option value="completed">完了</option>
                </select>
              </Field>
              <button onClick={() => setSelected(null)} className="min-h-12 rounded-lg bg-[#2878b8] px-7 font-bold text-white">更新して閉じる</button>
            </div>
          </section>
        </div>
      )}

      <footer className="mt-12 border-t border-[#e5e7eb] bg-white px-5 py-6 text-center text-xs text-[#888]">© 2026 あおぞら義肢装具 ｜ 個人情報保護方針</footer>
    </main>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) { 
  return (
    <div className="flex flex-1 flex-col gap-2">
      <label className="text-sm font-bold text-[#444]">{label} {required && <span className="ml-1 rounded bg-[#fff1e6] px-2 py-1 text-[11px] font-semibold text-[#c87534]">必須</span>}</label>
      {hint && <p className="-mt-1 text-xs text-[#888]">{hint}</p>}
      <div className="form-control">{children}</div>
    </div>
  ) 
}

function Detail({ label, value }: { label: string; value: string }) { 
  return (
    <div>
      <dt className="font-bold text-[#777]">{label}</dt>
      <dd className="mt-1 text-[#333]">{value}</dd>
    </div>
  ) 
}

function InfoCard({ onClick }: { onClick: () => void }) { 
  return (
    <section className="mx-auto mt-12 max-w-2xl rounded-2xl bg-[#eaf3fa] p-6 sm:p-8">
      <div className="flex gap-4">
        <ShieldCheck className="mt-1 shrink-0 text-[#2878b8]" />
        <div>
          <h2 className="font-bold text-[#174c74]">健康保険について</h2>
          <p className="mt-2 text-sm leading-6 text-[#567]">義肢装具に関する健康保険のご案内をご確認いただけます。</p>
          <button onClick={onClick} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#2878b8]">詳しく見る <ChevronRight /></button>
        </div>
      </div>
    </section>
  ) 
}