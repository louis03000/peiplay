'use client'
export default function Footer() {
  return (
    <footer className="backdrop-blur bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border-t border-white/10 text-center py-6">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-gray-300">
          &copy; {new Date().getFullYear()} PeiPlay. All rights reserved.
        </p>
      </div>
    </footer>
  )
} 