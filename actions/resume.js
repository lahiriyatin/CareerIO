"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function saveResume(content) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");
  try {
    const resume = await db.resume.upsert({
      where: {
        userId: user.id,
      },
      update: {
        content,
      },
      create: {
        userId: user.id,
        content,
      },
    });
    revalidatePath("/resume");
    return resume;
  } catch (e) {
    console.error("Error saving resume:", e);
    throw new Error("Failed to save resume");
  }
}

export async function getResume() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    return await db.resume.findUnique({
      where: {
        userId: user.id,
      },
    });
  } catch (e) {
    console.error("Error getting resume:", e);
    throw new Error("Failed to get resume");
  }
}

export async function improveWithAI({ current, type, organization }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  const prompt = `
  As an expert resume writer, improve the following ${type} description for a ${user.industry} professional at ${organization}.
  Make it more impactful, quantifiable, and aligned with industry standards.
  Current content: "${current}"

  Requirements:
  1. Use action verbs
  2. Include metrics and results where possible
  3. Highlight relevant technical skills
  4. Keep it concise but detailed
  5. Focus on achievements over responsibilities
  6. Use industry-specific keywords

  Format the response as a single paragraph without any additional text or explanations.
`;
  try {
    const result = await model.generateContent(prompt);
    const response = result.response;

    const improvedContent = response.text().trim();
    return improvedContent

  }catch (e) {
    console.error("Error improving content:", e);
    throw new Error("Failed to improve content");
  }
}
