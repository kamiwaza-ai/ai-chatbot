import * as React from 'react'
import { useRouter } from 'next/navigation'
import { shareChat } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { PromptForm } from '@/components/prompt-form'
import { ButtonScrollToBottom } from '@/components/button-scroll-to-bottom'
import { IconArrowElbow, IconPlus, IconShare } from '@/components/ui/icons'
import { FooterText } from '@/components/footer'
import { ChatShareDialog } from '@/components/chat-share-dialog'
import { useAIState, useActions, useUIState } from 'ai/rsc'
import { ModelInfo } from '@/lib/types'
import type { AI } from '@/lib/chat/actions'
import { nanoid } from 'nanoid'
import { UserMessage } from './stocks/message'
import { toast } from 'sonner'

export interface ChatPanelProps {
  id?: string
  title?: string
  input: string
  setInput: (value: string) => void
  isAtBottom: boolean
  scrollToBottom: () => void
  selectedModel: ModelInfo | null
  isLoading?: boolean
}

export function ChatPanel({
  id,
  title,
  input,
  setInput,
  isAtBottom,
  scrollToBottom,
  selectedModel,
  isLoading
}: ChatPanelProps) {
  const router = useRouter()
  const [aiState] = useAIState()
  const [messages, setMessages] = useUIState<typeof AI>()
  const { submitUserMessage } = useActions()
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)

  const exampleMessages = [
    {
      heading: 'What are the',
      subheading: 'trending memecoins today?',
      message: `What are the trending memecoins today?`
    },
    {
      heading: 'What is the price of',
      subheading: '$DOGE right now?',
      message: 'What is the price of $DOGE right now?'
    },
    {
      heading: 'I would like to buy',
      subheading: '42 $DOGE',
      message: `I would like to buy 42 $DOGE`
    },
    {
      heading: 'What are some',
      subheading: `recent events about $DOGE?`,
      message: `What are some recent events about $DOGE?`
    }
  ]
  const handleSubmit = async (value: string) => {
    if (!selectedModel) {
      toast.error('Please select a model before sending a message.')
      return
    }

    setInput('')
    
    // Ensure we have an ID
    const currentId = id || nanoid()
    console.log('ChatPanel handleSubmit with ID:', currentId)

    try {
      // First update the URL if needed
      if (!id) {
        await router.push(`/chat/${currentId}`)
        // Small delay to ensure URL updates
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const responseMessage = await submitUserMessage({
        message: value,
        chatId: currentId,
        baseUrl: selectedModel.baseUrl,
        modelName: selectedModel.modelName
      })
      
      setMessages(currentMessages => [...currentMessages, responseMessage])
    } catch (error) {
      console.error('Error submitting message (chat-panel):', error)
      toast.error('Failed to send message. Please try again.')
    }
  }


  return (
    <div className="fixed inset-x-0 bottom-0 w-full bg-background p-4">
      <ButtonScrollToBottom
        isAtBottom={isAtBottom}
        scrollToBottom={scrollToBottom}
      />

      <div className="mx-auto max-w-3xl">
        <div className="flex items-center rounded-md bg-muted p-2">
          <PromptForm
            input={input}
            setInput={setInput}
            selectedModel={selectedModel}
            chatId={id}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
        <FooterText className="mt-3" />
      </div>
    </div>
  )
}
