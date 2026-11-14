'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FileText, HeartHandshake, LockKeyhole, LogOut, Paperclip, Search, ShieldCheck, X } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

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
  const [dataError, setDataError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoginError, setAdminLoginError] = useState('')
  const [insuranceDetail, setInsuranceDetail] = useState<'overview' | 'kyokai' | 'kokumin' | 'koki' | 'disability'>('overview')

  // Supabaseから全項目を取得
  useEffect(() => {
    let active = true
    const loadInquiries = async () => {
      const { data, error } = await getSupabaseClient()
        .from('inquiries')
        .select('id, created_at, name, email, phone, inquiry_type, target_part, message, file_url, status')
        .order('created_at', { ascending: false })

      if (!active) return
      if (error) {
        setDataError('お問い合わせデータを読み込めませんでした。')
        return
      }

      setInquiries((data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        phone: item.phone ?? '',
        type: item.inquiry_type ?? '',
        part: item.target_part ?? '',
        details: item.message,
        file: item.file_url ?? null,
        status: item.status === '対応中' ? 'in_progress' : item.status === '完了' ? 'completed' : 'pending',
        createdAt: new Date(item.created_at).toLocaleString('ja-JP'),
      })))
    }

    void loadInquiries()
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => inquiries.filter((item) => {
    const matchesQuery = `${item.name} ${item.email} ${item.phone} ${item.id} ${item.part}`.toLowerCase().includes(query.toLowerCase())
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

  // Supabase Storageへのファイルアップロード & データベース保存
  async function submitInquiry() {
    setDataError('')
    let filePath = null

    // 1. ファイルが選択されている場合、Supabase Storageにアップロード
    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`
      
      const { error: uploadError } = await getSupabaseClient()
        .storage
        .from('inquiry-files')
        .upload(fileName, file)

      if (uploadError) {
        setDataError('ファイルのアップロードに失敗しました。')
        return
      }
      filePath = fileName
    }

    // 2. データベースにお問い合わせデータを保存
    const { data, error: insertError } = await getSupabaseClient()
      .from('inquiries')
      .insert({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        inquiry_type: form.type,
        target_part: form.part,
        message: form.details,
        file_url: filePath,
      })
      .select('id, created_at, name, email, phone, inquiry_type, target_part, message, file_url, status')
      .single()

    if (insertError || !data) {
      setDataError('お問い合わせを送信できませんでした。時間をおいて再度お試しください。')
      return
    }

    setInquiries((items) => [{
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone ?? '',
      type: data.inquiry_type ?? '',
      part: data.target_part ?? '',
      details: data.message,
      file: data.file_url ?? null,
      status: 'pending',
      createdAt: new Date(data.created_at).toLocaleString('ja-JP'),
    }, ...items])
    setStep('complete')
  }

  async function updateStatus(status: Status) {
    if (!selected) return
    const nextStatus = status === 'in_progress' ? '対応中' : status === 'completed' ? '完了' : '未対応'
    const { error: updateError } = await getSupabaseClient()
      .from('inquiries')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', selected.id)

    if (updateError) {
      setDataError('ステータスを更新できませんでした。')
      return
    }

    setInquiries((items) => items.map((item) => item.id === selected.id ? { ...item, status } : item))
    setSelected({ ...selected, status })
  }

  // Storageのファイル公開URLを取得するヘルパー
  const getFileUrl = (path: string | null) => {
    if (!path) return '#'
    const { data } = getSupabaseClient()
      .storage
      .from('inquiry-files')
      .getPublicUrl(path)
    return data.publicUrl
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
              {dataError && <p className="mt-4 rounded-lg bg-[#fff3f1] px-4 py-3 text-sm text-[#c24b3d]" role="alert">{dataError}</p>}
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button onClick={() => setStep('form')} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#b9d1e1] px-6 font-semibold text-[#2878b8]"><ChevronLeft />戻って修正する</button>
                <button onClick={submitInquiry} className="min-h-12 rounded-lg bg-[#2878b8] px-8 font-bold text-white">入力・送信</button>
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
        <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
          <section className="rounded-2xl border border-[#e4edf3] bg-white p-7 shadow-sm sm:p-10">
            <ShieldCheck className="text-[#2878b8]" />
            <h1 className="mt-5 text-3xl font-bold text-[#174c74]">健康保険・公的制度について</h1>
            <p className="mt-4 text-sm leading-7 text-[#666]">義肢装具を作製する場合に利用できる主な制度と、申請の流れをご案内します。適用条件や必要書類は保険者・自治体によって異なるため、必ず担当窓口へご確認ください。</p>

            <div className="mt-8 rounded-xl bg-[#f5f9fc] p-6">
              <h2 className="text-lg font-bold text-[#174c74]">医療保険共通の準備書類</h2>
              <p className="mt-2 text-sm leading-6 text-[#666]">治療用装具は、いったん製作費の全額をお支払いいただき、後から自己負担分を除いた金額の療養費支給を申請します。</p>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#567] sm:grid-cols-2">
                {['医師の証明書（意見書および装着証明書など）','義肢装具会社の領収書（原本）','療養費支給申請書（各保険者の様式）','振込先口座の情報（通帳・キャッシュカードなど）','内訳書・靴型装具の写真（必要な場合）'].map((item) => <li key={item} className="flex gap-2"><span className="text-[#2878b8]">●</span>{item}</li>)}
              </ul>
            </div>

            {insuranceDetail === 'overview' ? (
              <div className="mt-8 grid gap-4">
                {[
                  { key: 'kyokai' as const, title: '① 協会けんぽ（全国健康保険協会）', text: '会社員やそのご家族などが加入する健康保険です。療養費の申請方法をご案内します。' },
                  { key: 'kokumin' as const, title: '② 国民健康保険（国保）', text: '自営業、主婦、退職者などが加入する市区町村主体の健康保険です。' },
                  { key: 'koki' as const, title: '③ 後期高齢者医療制度', text: '75歳以上の方、または一定の障害認定を受けた方が対象の制度です。' },
                  { key: 'disability' as const, title: '④ 補装具費支給制度', text: '身体障害者手帳による更生用装具の事前申請・判定についてご案内します。' },
                ].map((item) => (
                  <button key={item.key} onClick={() => setInsuranceDetail(item.key)} className="group rounded-xl border border-[#d9e6ef] p-6 text-left transition hover:border-[#2878b8] hover:bg-[#f7fbfd]">
                    <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-[#174c74]">{item.title}</h2><p className="mt-2 text-sm leading-6 text-[#567]">{item.text}</p></div><ChevronRight className="shrink-0 text-[#2878b8] transition group-hover:translate-x-1" /></div>
                    <span className="mt-4 inline-block text-sm font-bold text-[#2878b8]">制度の詳細を見る</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-xl border border-[#d9e6ef] p-6">
                <button onClick={() => setInsuranceDetail('overview')} className="mb-6 flex items-center gap-2 text-sm font-bold text-[#2878b8]"><ChevronLeft />制度一覧へ戻る</button>
                {insuranceDetail === 'kyokai' && <InsuranceDetail title="① 協会けんぽ（全国健康保険協会）" description="会社員やそのご家族などが加入する健康保険です。原則7割還付（自己負担3割、未就学児は8割還付）です。" steps={['病院を受診し、型取り・装具の受け取りを行います。','製作費を全額支払い、領収書を受け取ります。','療養費支給申請書を入手・記入します。','必要書類を協会けんぽ支部または会社窓口へ提出します。','審査後、指定口座へ約1〜2か月後に振り込まれます。']} />}
                {insuranceDetail === 'kokumin' && <InsuranceDetail title="② 国民健康保険（国保）" description="自営業、主婦、退職者などが加入する市区町村主体の健康保険です。給付割合は年齢や所得により異なります。" steps={['病院を受診し、装具を受け取り、代金を全額支払います。','お住まいの市区町村役所の国民健康保険課へ行きます。','共通書類に加え、世帯主のマイナンバー確認書類・本人確認書類を提出します。','審査後、世帯主名義の口座へ還付されます。']} />}
                {insuranceDetail === 'koki' && <InsuranceDetail title="③ 後期高齢者医療制度" description="75歳以上の方、または一定の障害認定を受けた65歳〜74歳の方が対象です。原則9割還付（所得により8割・7割）です。" steps={['病院を受診し、装具を受け取り、代金を全額支払います。','市区町村役所の後期高齢者医療窓口へ申請します。','共通書類に加え、本人のマイナンバー確認書類・受給者証を提出します。','審査後、本人名義の口座へ還付されます。']} />}
                {insuranceDetail === 'disability' && <InsuranceDetail title="④ 身体障害者手帳による手続き（補装具費支給制度）" description="日常生活のための更生用装具は、事前申請と判定を経て、原則1割負担で製作します。世帯所得に応じた月額上限があります。" steps={['市区町村役所の障害福祉課へ事前相談・申請します。','指定医から補装具費支給意見書を取得します。','義肢装具会社から見積書を取得します。','障害者更生相談所の判定を受けます。','支給決定・支給券の交付後、契約・採型・製作を行います。','適合判定後、自己負担分を支払い受け取ります。']} />}
              </div>
            )}

            <div className="mt-8 rounded-xl border border-[#cfe3ef] bg-[#eef7fb] p-6">
              <h2 className="text-xl font-bold text-[#174c74]">身体障害者手帳による手続き（補装具費支給制度）</h2>
              <p className="mt-2 text-sm leading-6 text-[#567]">日常生活のための更生用装具は、事前申請と判定を経て、原則1割負担で製作します。世帯所得に応じた月額上限があり、非課税世帯は0円です。</p>
              <ol className="mt-4 grid gap-2 text-sm leading-6 text-[#666] list-decimal pl-5"><li>市区町村役所の障害福祉課へ事前相談・申請します。</li><li>指定医から補装具費支給意見書を取得します。</li><li>義肢装具会社から見積書を取得します。</li><li>障害者更生相談所の判定を受けます。</li><li>支給決定・支給券の交付後、契約・採型・製作を行います。</li><li>適合判定後、自己負担分を支払い受け取ります。</li></ol>
            </div>

            <p className="mt-8 rounded-lg bg-[#fff9ed] px-4 py-3 text-sm leading-6 text-[#765d2d]">制度の内容は変更される場合があります。申請前に、加入している保険者またはお住まいの自治体へ最新情報をご確認ください。</p>
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
          {dataError && <p className="mb-4 rounded-lg bg-[#fff3f1] px-4 py-3 text-sm text-[#c24b3d]" role="alert">{dataError}</p>}
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#e4edf3] bg-white p-4 sm:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-[#d9e6ef] px-3">
              <Search className="text-[#8ba0ae]" />
              <input className="w-full border-0 py-3 outline-none" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="名前・メール・電話番号・ID・部位で検索" />
            </label>
            <select className="rounded-lg border border-[#d9e6ef] px-3 py-3" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">すべてのステータス</option>
              <option value="pending">未対応</option>
              <option value="in_progress">対応中</option>
              <option value="completed">完了</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#e4edf3] bg-white">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-[#f5f9fc] text-xs text-[#777]">
                <tr>
                  <th className="px-4 py-4">受付日時</th>
                  <th className="px-4 py-4">お名前</th>
                  <th className="px-4 py-4">メールアドレス</th>
                  <th className="px-4 py-4">電話番号</th>
                  <th className="px-4 py-4">相談区分</th>
                  <th className="px-4 py-4">部位</th>
                  <th className="px-4 py-4">相談内容</th>
                  <th className="px-4 py-4">添付</th>
                  <th className="px-4 py-4">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} onClick={() => setSelected(item)} className="cursor-pointer border-t border-[#edf0f2] hover:bg-[#f7fbfd]">
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-[#777]">{item.createdAt}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-bold text-[#333]">{item.name}</td>
                    <td className="px-4 py-4 text-[#567]">{item.email}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-[#567]">{item.phone || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-4">{item.type}</td>
                    <td className="whitespace-nowrap px-4 py-4">{item.part || '-'}</td>
                    <td className="max-w-[200px] truncate px-4 py-4 text-[#567]">{item.details}</td>
                    <td className="px-4 py-4 text-center text-[#2878b8]">{item.file ? <FileText className="mx-auto size-4" /> : '-'}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === 'pending' ? 'bg-[#fff1e6] text-[#c87534]' : item.status === 'in_progress' ? 'bg-[#eaf3fa] text-[#2878b8]' : 'bg-[#e7f6ee] text-[#2c9a63]'}`}>
                        {statusLabel[item.status]}
                      </span>
                    </td>
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
              <Detail label="対象部位・種類" value={selected.part || '未入力'} />
              <Detail label="受付日時" value={selected.createdAt} />
              <div className="sm:col-span-2">
                <dt className="font-bold text-[#777]">相談内容</dt>
                <dd className="mt-2 whitespace-pre-wrap rounded-lg bg-[#f7fafc] p-4 leading-7">{selected.details}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-bold text-[#777]">添付ファイル</dt>
                <dd className="mt-2 flex items-center gap-2 text-[#2878b8]">
                  {selected.file ? (
                    <a 
                      href={getFileUrl(selected.file)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-2 underline hover:text-[#1f679f]"
                    >
                      <FileText /> ファイルを開く（ダウンロード）
                    </a>
                  ) : (
                    '添付ファイルなし'
                  )}
                </dd>
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

function InsuranceDetail({ title, description, steps }: { title: string; description: string; steps: string[] }) {
  return (
    <div>
      <h2 className="text-2xl font-bold leading-relaxed text-[#174c74]">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-[#567]">{description}</p>
      <h3 className="mt-7 text-lg font-bold text-[#174c74]">申請の流れ</h3>
      <ol className="mt-4 grid gap-3 text-sm leading-7 text-[#666]">
        {steps.map((step, index) => <li key={step} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eaf3fa] text-xs font-bold text-[#2878b8]">{index + 1}</span><span>{step}</span></li>)}
      </ol>
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