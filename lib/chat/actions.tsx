import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import { createOpenAI } from '@ai-sdk/openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase
} from '@/components/stocks'

import { z } from 'zod'
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat, Message, ModelInfo } from '@/lib/types'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/kamiwazaApi'
import { getDockerizedUrl } from '@/lib/utils'

async function confirmPurchase(symbol: string, price: number, amount: number) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  const purchasing = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Purchasing {amount} ${symbol}...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    purchasing.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}... working on it...
        </p>
      </div>
    )

    await sleep(1000)

    purchasing.done(
      <div>
        <p className="mb-2">
          You have successfully purchased {amount} ${symbol}. Total cost:{' '}
          {formatNumber(amount * price)}
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        You have purchased {amount} shares of {symbol} at ${price}. Total cost ={' '}
        {formatNumber(amount * price)}.
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'system',
          content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
            amount * price
          }]`
        }
      ]
    })
  })

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}

async function selectModel(baseUrl: string, modelName: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()
  
  aiState.update({
    ...aiState.get(),
    selectedModel: { baseUrl, modelName }
  })

  return { success: true }
}

async function submitUserMessage({
  message,
  chatId,
  baseUrl,
  modelName
}: {
  message: string
  chatId: string
  baseUrl: string
  modelName: string
}) {
  'use server'

  if (!chatId) {
    throw new Error('chatId is required for submitUserMessage')
  }

  console.log('submitUserMessage: Starting with chatId:', chatId)
  
  const aiState = getMutableAIState<typeof AI>()
  const currentState = aiState.get()
  
  // Keep existing model or use the new one
  const selectedModel = currentState.selectedModel || { baseUrl, modelName }
  
  aiState.update({
    chatId,
    messages: [
      ...currentState.messages,
      { id: nanoid(), role: 'user', content: message }
    ],
    selectedModel  // Use the preserved model info
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const openai = createOpenAI({
    baseURL: getDockerizedUrl(selectedModel.baseUrl),  // Use the preserved model's baseUrl
    apiKey: 'kamiwaza_model'
  })

  console.log(`Created OpenAI client with baseURL: ${getDockerizedUrl(selectedModel.baseUrl)}`)

  const result = await streamUI({
    model: openai(selectedModel.baseUrl.includes('localhost') ? selectedModel.modelName : 'model'),
    initial: <SpinnerMessage />,
    system: `You are a helpful AI assistant.`,
    messages: [
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      })),
      { role: 'user', content: message }
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} selectedModel={selectedModel} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ],
          selectedModel  // Make sure to preserve the model in the final state
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    }
  })

  console.log('submitUserMessage result:', result)
  return {
    id: nanoid(),
    display: result.value
  }
}

export type AIState = {
  chatId: string
  messages: Message[]
  selectedModel?: KamiwazaModel
}

type KamiwazaModel = {
  baseUrl: string;
  modelName: string;
};

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
            return tool.toolName === 'listStocks' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Stocks props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPrice' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Stock props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPurchase' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Purchase props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Events props={tool.result} />
              </BotCard>
            ) : null
          })
        ) : message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage 
            content={message.content} 
            selectedModel={aiState.selectedModel ?? null} 
          />
        ) : null
    }))
}

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmPurchase,
    selectModel
  },
  initialUIState: [],
  initialAIState: {
    chatId: '', 
    messages: [],
    selectedModel: undefined
  },
  onGetUIState: async () => {
    'use server'

    const cookieStore = cookies()
    const token = cookieStore.get('access_token')?.value
    let userData = null

    if (token) {
      try {
        userData = await verifyToken(token)
      } catch (error) {
        console.error('Error verifying token:', error)
      }
    }

    if (userData) {
      const aiState = getAIState() as Chat
      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    }
    return
  },
  onSetAIState: async ({ state, done }) => {
    'use server'
    
    if (!state.chatId) {
      console.error('onSetAIState: No chatId in state')
      return;
    }

    console.log('onSetAIState: Starting with chatId:', state.chatId)
    
    if (!done) return;

    const cookieStore = cookies()
    const token = cookieStore.get('access_token')?.value
    console.log('onSetAIState: Token:', token?.substring(0, 10) + '...')
    
    console.log('onSetAIState: Attempting to verify token with Kamiwaza API')
    
    let userData = null
    if (token) {
      try {
        userData = await verifyToken(token)
        console.log('onSetAIState: UserData after verify:', userData)
      } catch (error) {
        console.error('onSetAIState: Error verifying token:', error)
        return;
      }
    }

    if (!userData?.id) {
      console.log('onSetAIState: No valid user, not saving chat')
      return;
    }

    const { chatId, messages, selectedModel } = state
    const createdAt = new Date()
    const userId = userData.id
    const path = `/chat/${chatId}`

    const firstMessageContent = messages[0]?.content as string || 'New Chat'
    const title = firstMessageContent.substring(0, 100)

    const chat: Chat = {
      id: chatId,
      title,
      userId,
      createdAt,
      messages,
      path,
      selectedModel
    }

    console.log('onSetAIState: Saving chat:', {
      id: chat.id,
      userId: chat.userId,
      messageCount: chat.messages.length,
      selectedModel: chat.selectedModel  // Add logging for selectedModel
    })
    
    await saveChat(chat)
    console.log('onSetAIState: Chat saved')
  }
})