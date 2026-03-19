'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import type { Message } from '../types/message.types'

const AI_GUEST_ID = 'ai-assistant-myai'
const AI_NAME = 'MyAI'
const GEMINI_MODEL = 'gemma-3-27b-it'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export async function getAIResponse(
  roomId: string,
  userMessage: string,
  context: Message[]
): Promise<{ success: boolean; message?: Message; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { success: false, error: 'AI assistant is not configured.' }
  }

  // Strip the @MyAI mention to get the actual question
  const question = userMessage.replace(/@myai/gi, '').trim()

  // Build conversation context (last 15 messages)
  const contextLines = context
    .slice(-15)
    .map((m) => `${m.sender_name}: ${m.body}`)
    .join('\n')

  const systemPrompt = `You are MyAI, a helpful AI assistant embedded in a real-time chat room called ChatboxAI. Answer questions concisely — typically 1-3 sentences unless more is clearly needed. If the question relates to the conversation, use the context below.\n\nRecent conversation:\n${contextLines}`

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\nUser question: ${question || 'Hello!'}`,
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[ai-response] Gemini error:', err)
      return { success: false, error: 'AI request failed.' }
    }

    const geminiData = await response.json()
    const aiText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      'Sorry, I could not generate a response.'

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        sender_guest_id: AI_GUEST_ID,
        sender_name: AI_NAME,
        body: aiText,
      })
      .select('id, room_id, sender_guest_id, sender_name, body, created_at')
      .single()

    if (error || !data) {
      console.error('[ai-response] insert error:', error)
      return { success: false, error: 'Failed to save AI response.' }
    }

    return { success: true, message: data }
  } catch (err) {
    console.error('[ai-response] error:', err)
    return { success: false, error: 'AI request failed.' }
  }
}
