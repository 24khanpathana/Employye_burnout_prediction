import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'BurnoutGuard — AI-Powered Employee Burnout Prediction',
  description: 'Predict employee burnout before it happens using Logistic Regression and Apriori pattern mining. AI-powered workforce analytics for smarter HR decisions.',
  keywords: ['employee burnout', 'HR analytics', 'burnout prediction', 'workforce analytics', 'machine learning HR'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased text-gray-100 bg-gray-950`}>
        {children}
      </body>
    </html>
  )
}
