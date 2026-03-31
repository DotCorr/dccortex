/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    // Don't reveal if user exists (security best practice)
    // Always return success, but only send email if user exists
    if (user) {
      // Generate reset token
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 1) // 1 hour expiry

      // Delete any existing reset tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      })

      // Create new reset token
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      })

      // Send reset email
      const resetLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password/${token}`
      
      try {
        await sendPasswordResetEmail(user.email, resetLink)
      } catch (emailError: any) {
        // Log error but don't fail the request (security - don't reveal email issues)
        console.error('[Password Reset] Email error:', emailError.message)
      }
    }

    // Always return success (don't reveal if user exists)
    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process request', message: error.message },
      { status: 500 }
    )
  }
}

