import { motion } from 'motion/react'
import { Link } from 'react-router'
import { Button } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: [0, -10, 0], opacity: 1 }}
        transition={{ y: { repeat: Infinity, duration: 3, ease: 'easeInOut' }, opacity: { duration: 0.4 } }}
        className="font-display text-8xl font-bold text-gradient"
      >
        404
      </motion.div>
      <h1 className="mt-4 text-2xl font-bold">Off route!</h1>
      <p className="mt-2 text-ink-300">This page doesn't exist. Down-climb to safety.</p>
      <Link to="/" className="mt-6"><Button>Back to the ground</Button></Link>
    </div>
  )
}
