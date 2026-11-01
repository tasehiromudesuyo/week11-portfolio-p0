'use client'

import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FileText, HeartHandshake, Paperclip, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const initialForm = { name: '', email: '', phone: '', type: '', part: '', details: '', consent: false }

export default function Page() {
  const [step, setStep] = useState<'form' | 'confirm' | 'complete'>('form')
  const [form, setForm] = useState(initialForm)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

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
    setStep('confirm')
  }

  // Supabaseへデータを送信する関数
  async function handleInsert() {
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .insert([
          {
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            category: form.type,
            target_part: form.part,
            content: form.details,
            file_url: file ? file.name : null, // 添付ファイル名（またはなし）
          }
        ])

      if (error) throw error

      // 送信成功したら完了画面へ進む
      setStep('complete')
    } catch (err: any) {
      console.error('送信エラー:', err.message)
      alert('送信に失敗しました: ' + err.message)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f9fc] text-[#333]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#2878b8] text-white"><HeartHandshake /></div>
            <div><p className="text-lg font-bold tracking-wide text-[#174c74]">あおぞら義肢装具</p><p className="text-xs text-[#777]">いつでも、安心してご相談ください</p></div>
          </div>
          <a href="#insurance" className="hidden text-sm font-semibold text-[#2878b8] sm:block">健康保険について</a>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-14">
        <div className="mb-9 flex items-center justify-center gap-3 text-xs font-semibold sm:gap-5 sm:text-sm">
          {['入力', '確認', '完了'].map((label, index) => { const active = (step === 'form' ? 0 : step === 'confirm' ? 1 : 2) >= index; return <div key={label} className="flex items-center gap-2"><span className={`flex size-8 items-center justify-center rounded-full ${active ? 'bg-[#2878b8] text-white' : 'bg-[#e5edf3] text-[#789]'} `}>{active && index < (step === 'form' ? 0 : step === 'confirm' ? 1 : 2) ? <Check /> : index + 1}</span><span className={active ? 'text-[#2878b8]' : 'text-[#8a9aa8'}>{label}</span>{index < 2 && <span className="mx-1 h-px w-8 bg-[#d8e4ec] sm:w-16" />}</div> })}
        </div>

        {step === 'form' && <section className="mx-auto max-w-2xl rounded-2xl border border-[#e4edf3] bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-8"><p className="mb-2 text-sm font-bold text-[#2878b8]">CONTACT FORM</p><h1 className="text-2xl font-bold text-[#174c74] sm:text-3xl">お問い合わせ</h1><p className="mt-3 text-sm leading-7 text-[#777]">義肢装具に関するご相談を、24時間いつでも受け付けています。内容を確認のうえ、担当者よりご連絡いたします。</p></div>
          <form onSubmit={review} className="flex flex-col gap-6">
            <Field label="お名前" required><input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="例：山田 太郎" /></Field>
            <Field label="メールアドレス" required><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="例：info@example.jp" /></Field>
            <Field label="電話番号" hint="日中ご連絡のつきやすい番号"><input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="例：090-0000-0000" /></Field>
            <Field label="相談区分" required><select value={form.type} onChange={(e) => update('type', e.target.value)}><option value="">選択してください</option><option>新しく作りたい</option><option>調整・修理について</option><option>書類・保険について</option><option>その他</option></select></Field>
            <Field label="対象部位・種類" required><select value={form.part} onChange={(e) => update('part', e.target.value)}><option value="">選択してください</option><option>義足</option><option>義手</option><option>装具（足・膝・腰など）</option><option>その他</option></select></Field>
            <Field label="相談内容" required hint="症状やお困りのことをできるだけ詳しくご記入ください"><textarea rows={5} value={form.details} onChange={(e) => update('details', e.target.value)} placeholder="ご相談内容をご入力ください" /></Field>
            <Field label="写真・処方箋ファイル" hint="JPG / PNG / PDF（10MBまで）"><label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#b9d1e1] bg-[#f7fbfd] px-4 py-4 text-sm text-[#567] hover:bg-[#eef7fb]"><Paperclip className="text-[#2878b8]" /><span>{file ? file.name : 'ファイルを選択してください'}</span><input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></Field>
            <label className="flex items-start gap-3 text-sm leading-6 text-[#555]"><input className="mt-1 size-4 accent-[#2878b8]" type="checkbox" checked={form.consent} onChange={(e) => update('consent', e.target.checked)} /><span><a href="#privacy" className="font-semibold text-[#2878b8] underline">個人情報保護方針</a>に同意する <b className="ml-1 rounded bg-[#fff1e6] px-2 py-1 text-xs font-semibold text-[#c87534]">必須</b></span></label>
            {error && <p className="rounded-lg bg-[#fff3f1] px-4 py-3 text-sm text-[#c24b3d]" role="alert">{error}</p>}
            <button className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[#2878b8] px-6 text-base font-bold text-white shadow-sm transition hover:bg-[#1f679f]" type="submit">確認画面へ進む <ChevronRight /></button>
          </form>
        </section>}

        {step === 'confirm' && <section className="mx-auto max-w-2xl rounded-2xl border border-[#e4edf3] bg-white p-6 shadow-sm sm:p-10"><p className="mb-2 text-sm font-bold text-[#2878b8]">PLEASE CHECK</p><h1 className="text-2xl font-bold text-[#174c74]">お問い合わせ内容の確認</h1><p className="mt-3 text-sm text-[#777]">入力内容をご確認ください。問題なければ送信してください。</p><div className="mt-8 overflow-hidden rounded-xl border border-[#e5e7eb]">{[['お名前', form.name], ['メールアドレス', form.email], ['電話番号', form.phone || '未入力'], ['相談区分', form.type], ['対象部位・種類', form.part], ['相談内容', form.details], ['添付ファイル', file?.name || 'なし']].map(([label, value]) => <div key={label} className="grid gap-2 border-b border-[#edf0f2] px-4 py-4 last:border-0 sm:grid-cols-[150px_1fr]"><dt className="text-sm font-semibold text-[#777]">{label}</dt><dd className="whitespace-pre-wrap text-sm leading-6 text-[#333]">{value}</dd></div>)}</div><div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button onClick={() => setStep('form')} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#b9d1e1] px-6 font-semibold text-[#2878b8]"><ChevronLeft />戻って修正する</button><button onClick={handleInsert} className="min-h-12 rounded-lg bg-[#2878b8] px-8 font-bold text-white hover:bg-[#1f679f]">入力・送信</button></div></section>}

        {step === 'complete' && <section className="mx-auto max-w-2xl rounded-2xl border border-[#e4edf3] bg-white px-6 py-14 text-center shadow-sm sm:px-10"><div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[#e7f6ee] text-[#2c9a63]"><Check className="size-10" /></div><h1 className="mt-7 text-2xl font-bold text-[#174c74]">受付完了しました</h1><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#666]">お問い合わせありがとうございます。担当者が内容を確認し、必要に応じてご連絡いたします。</p><button onClick={() => { setForm(initialForm); setFile(null); setStep('form') }} className="mt-9 min-h-12 rounded-lg bg-[#2878b8] px-10 font-bold text-white hover:bg-[#1f679f]">トップへ戻る</button></section>}

        <section id="insurance" className="mx-auto mt-12 max-w-2xl rounded-2xl bg-[#eaf3fa] p-6 sm:p-8"><div className="flex gap-4"><ShieldCheck className="mt-1 shrink-0 text-[#2878b8]" /><div><h2 className="font-bold text-[#174c74]">健康保険について</h2><p className="mt-2 text-sm leading-6 text-[#567]">健康保険に関する詳しいご案内は、準備が整い次第公開します。ご不明な点はお問い合わせください。</p><a href="#" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#2878b8]">詳しく見る <ChevronRight /></a></div></div></section>
      </div>
      <footer className="border-t border-[#e5e7eb] bg-white px-5 py-6 text-center text-xs text-[#888]">© 2026 あおぞら義肢装具 ｜ 個人情報保護方針</footer>
    </main>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><label className="text-sm font-bold text-[#444]">{label} {required && <span className="ml-1 rounded bg-[#fff1e6] px-2 py-1 text-[11px] font-semibold text-[#c87534]">必須</span>}</label>{hint && <p className="-mt-1 text-xs text-[#888]">{hint}</p>}<div className="form-control">{children}</div></div>
}