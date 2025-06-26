'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const isActive = (path) => pathname === path;

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.refresh();
  };

  return (
    <nav className="bg-green-600 shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <span className="text-white font-bold text-xl">SwachhMap</span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className={`text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'text-white underline underline-offset-4'
                  : 'text-green-100 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link
              href="/report"
              className={`text-sm font-medium transition-colors ${
                isActive('/report')
                  ? 'text-white underline underline-offset-4'
                  : 'text-green-100 hover:text-white'
              }`}
            >
              Report
            </Link>
            <Link
              href="/explore"
              className={`text-sm font-medium transition-colors ${
                isActive('/explore')
                  ? 'text-white underline underline-offset-4'
                  : 'text-green-100 hover:text-white'
              }`}
            >
              Explore
            </Link>

            {/* Auth Section */}
            {!loading &&
              (user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="cursor-pointer border border-white">
                      <AvatarImage
                        src="/user-avatar.png"
                        alt="user"
                      />
                      <AvatarFallback>
                        {user.username?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>
                      Hello, {user.username}
                    </DropdownMenuLabel>
                    {user.isAdmin && (
                      <DropdownMenuItem disabled>
                        Admin Access
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="bg-white text-green-600 hover:bg-green-50">
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button asChild className="bg-white text-green-600 hover:bg-green-50">
                    <Link href="/register">Register</Link>
                  </Button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
