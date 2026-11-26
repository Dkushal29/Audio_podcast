-- Make Notification.annotationId and Notification.replyId nullable for video moment, mention, and question notifications
ALTER TABLE "Notification" ALTER COLUMN "annotationId" DROP NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "replyId" DROP NOT NULL;
