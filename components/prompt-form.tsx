'use client'

import * as React from 'react'
import Textarea from 'react-textarea-autosize'
import { useActions, useUIState } from 'ai/rsc'
import { UserMessage } from './stocks/message'
import { type AI } from '@/lib/chat/actions'
import { Button } from '@/components/ui/button'
import { IconArrowElbow, IconPlus } from '@/components/ui/icons'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'
import { ModelInfo } from '@/lib/types'
import { toast } from 'sonner'
import { verifyToken } from '@/lib/kamiwazaApi'

interface PromptFormProps {
  input: string
  setInput: (value: string) => void
  selectedModel: ModelInfo | null
  chatId?: string
}

export function PromptForm({
  input,
  setInput,
  selectedModel,
  chatId
}: PromptFormProps) {
  const router = useRouter()
  const { formRef, onKeyDown } = useEnterSubmit()
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const { submitUserMessage } = useActions()
  const [_, setMessages] = useUIState<typeof AI>()

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedModel) {
      toast.error('Please select a model before sending a message.')
      return
    }

    // Blur focus on mobile
    if (window.innerWidth < 600) {
      inputRef.current?.blur()
    }

    const value = input.trim()
    setInput('')
    if (!value) return

    // Generate an ID if we don't have one
    const currentId = chatId || nanoid()
    
    // Get current user data
    const userData = await verifyToken()
    console.log('handleSubmit: UserData:', userData)  // Debug user data

    // Update URL if needed
    if (!chatId) {
      await router.push(`/chat/${currentId}`)
      // Small delay to ensure URL updates
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Optimistically add user message UI
    setMessages(currentMessages => [
      ...currentMessages,
      {
        id: nanoid(),
        display: <UserMessage>{value}</UserMessage>
      }
    ])

    try {
      // Submit and get response message
      const responseMessage = await submitUserMessage({
        message: value,
        chatId: currentId,
        baseUrl: selectedModel.baseUrl,
        modelName: selectedModel.modelName,
        userId: userData?.id || 'anonymous'  // Add userId here
      })
      setMessages(currentMessages => [...currentMessages, responseMessage])
    } catch (error) {
      console.error('Error submitting message:', error)
      toast.error('Failed to send message. Please try again.')
    }
  }

  console.log('PromptForm render, selectedModel:', selectedModel);

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="relative flex max-h-60 w-full grow flex-col overflow-hidden bg-background px-8 sm:rounded-md sm:border sm:px-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-[14px] size-8 rounded-full bg-background p-0 sm:left-4"
              onClick={() => {
                router.push('/new')
              }}
            >
              <IconPlus />
              <span className="sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
        <Textarea
          ref={inputRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          placeholder="Send a message."
          className="min-h-[60px] w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          name="message"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <div className="absolute right-0 top-[13px] sm:right-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" size="icon" disabled={input === ''}>
                <IconArrowElbow />
                <span className="sr-only">Send message</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </form>
  )
}
