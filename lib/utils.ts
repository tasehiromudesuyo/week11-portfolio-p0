import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

TypeScript
const { data, error } = await supabase
  .from('inquiries')
  .insert([
    {
      name: name,
      email: email,
      phone: phone,
      category: category,
      target_part: targetPart,
      content: content,
    }
  ])

if (error) {
  console.error('挿入エラー:', error)
} else {
  console.log('送信成功:', data)
}