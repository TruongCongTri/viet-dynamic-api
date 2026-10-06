/*
  Warnings:

  - You are about to alter the column `basePrice` on the `Course` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(12,0)`.
  - A unique constraint covering the columns `[slug]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "publishedCourseCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalStudents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "basePrice" SET DATA TYPE DECIMAL(12,0);

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "isPreview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "totalCourses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalStudents" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Category_totalStudents_idx" ON "Category"("totalStudents" DESC);

-- CreateIndex
CREATE INDEX "Category_publishedCourseCount_idx" ON "Category"("publishedCourseCount" DESC);

-- CreateIndex
CREATE INDEX "Course_status_createdAt_idx" ON "Course"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Course_status_studentCount_idx" ON "Course"("status", "studentCount" DESC);

-- CreateIndex
CREATE INDEX "Course_status_averageRating_idx" ON "Course"("status", "averageRating" DESC);

-- CreateIndex
CREATE INDEX "Course_status_viewCount_idx" ON "Course"("status", "viewCount" DESC);

-- CreateIndex
CREATE INDEX "CourseReview_courseId_createdAt_idx" ON "CourseReview"("courseId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_slug_key" ON "UserProfile"("slug");

-- CreateIndex
CREATE INDEX "UserProfile_totalStudents_idx" ON "UserProfile"("totalStudents" DESC);

-- CreateIndex
CREATE INDEX "UserProfile_averageRating_idx" ON "UserProfile"("averageRating" DESC);

-- CreateIndex
CREATE INDEX "UserProfile_totalCourses_idx" ON "UserProfile"("totalCourses" DESC);
