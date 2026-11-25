import React, { useState } from 'react'
import { CornerDownRight } from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { Button } from '../ui/Button'

export function ReplyThread({ replies = [], onAddReply }) {
  const [replyText, setReplyText] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!replyText.trim()) return
    onAddReply?.(replyText.trim())
    setReplyText('')
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#27272F]/80 space-y-2.5">
      {replies.map((rep) => (
        <div key={rep.id} className="flex items-start gap-2.5 pl-2">
          <CornerDownRight className="w-3.5 h-3.5 text-[#52525B] mt-1 shrink-0" />
          <Avatar name={rep.authorName} color="#3F3F46" size="xs" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-[#F4F4F5]">
                {rep.authorName}
              </span>
              <span className="text-[11px] text-[#71717A]">{rep.createdAt}</span>
            </div>
            <p className="text-xs text-[#D4D4D8] mt-0.5 leading-relaxed">
              {rep.content}
            </p>
          </div>
        </div>
      ))}

      {onAddReply && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 h-8 px-2.5 rounded-md bg-[#09090B] border border-[#27272F] text-xs text-[#F4F4F5] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6]"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!replyText.trim()}>
            Reply
          </Button>
        </form>
      )}
    </div>
  )
}
