import { useState, useEffect } from 'react'
import axios from 'axios'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { ThemeToggle } from './components/theme-toggle'
import { Toaster } from './components/ui/toast'
import NowPlaying from './components/NowPlaying'
import QueueForm from './components/QueueForm'
import Queue from './components/Queue'
import Display from './components/Display'
import DeviceManagement from './components/DeviceManagement'
import BannedTracks from './components/BannedTracks'
import Configuration from './components/Configuration'
import Stats from './components/Stats'
import SpotifyConnect from './components/SpotifyConnect'
import QueueManagement from './components/QueueManagement'
import PrequeueManagement from './components/PrequeueManagement'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs'
import { Music, ArrowLeft, Github, Shield } from 'lucide-react'
import { useAuraColor } from './hooks/useAuraColor'

axios.defaults.withCredentials = true

function ClientPage() {
  const [fingerprintId, setFingerprintId] = useState(null)
  const [nowPlaying, setNowPlaying] = useState(null)
  const [loading, setLoading] = useState(true)
  const [requiresUsername, setRequiresUsername] = useState(false)
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [githubAvailable, setGithubAvailable] = useState(false)
  const [hackClubAvailable, setHackClubAvailable] = useState(false)
  const [requiresGithubAuth, setRequiresGithubAuth] = useState(false)
  const [requiresHackClubAuth, setRequiresHackClubAuth] = useState(false)
  const [oauthError, setOauthError] = useState('')
  const [auraEnabled, setAuraEnabled] = useState(false)
  const [myTrackId, setMyTrackId] = useState(null)

  const auraColor = useAuraColor(auraEnabled ? nowPlaying?.album_art : null)

  useEffect(() => {
    // Check URL params for GitHub callback
    const params = new URLSearchParams(window.location.search)
    const githubAuthSuccess = params.get('github_auth') === 'success'
    const hackClubAuthSuccess = params.get('hackclub_auth') === 'success'
    const oauthErrorParam = params.get('error')
    const oauthErrorDetail = params.get('error_detail')

    if (githubAuthSuccess || hackClubAuthSuccess || oauthErrorParam) {
      window.history.replaceState({}, '', '/')
    }

    if (oauthErrorParam) {
      if (oauthErrorDetail) {
        setOauthError(`Authentication failed: ${oauthErrorDetail}`)
      } else {
        setOauthError('Authentication failed. Please try again.')
      }
    }

    // Check OAuth provider status in parallel
    Promise.allSettled([
      axios.get('/api/github/status'),
      axios.get('/api/hackclub/status')
    ]).then(([githubStatus, hackClubStatus]) => {
      if (githubStatus.status === 'fulfilled') {
        setGithubAvailable(!!githubStatus.value?.data?.configured)
      }
      if (hackClubStatus.status === 'fulfilled') {
        setHackClubAvailable(!!hackClubStatus.value?.data?.configured)
      }
    })

    axios.post('/api/fingerprint/generate')
      .then(response => {
        const data = response.data || {}
        setFingerprintId(data.fingerprint_id)
        setRequiresUsername(data.requires_username || false)
        setRequiresGithubAuth(data.requires_github_auth || false)
        setRequiresHackClubAuth(data.requires_hackclub_auth || false)
        if (typeof data.github_oauth_configured === 'boolean') {
          setGithubAvailable(data.github_oauth_configured)
        }
        if (typeof data.hackclub_oauth_configured === 'boolean') {
          setHackClubAvailable(data.hackclub_oauth_configured)
        }
        setLoading(false)
      })
      .catch(error => {
        const data = error.response?.data || {}
        if (data.requires_username || data.requires_github_auth || data.requires_hackclub_auth) {
          setRequiresUsername(!!data.requires_username)
          setRequiresGithubAuth(!!data.requires_github_auth)
          setRequiresHackClubAuth(!!data.requires_hackclub_auth)
          if (typeof data.github_oauth_configured === 'boolean') {
            setGithubAvailable(data.github_oauth_configured)
          }
          if (typeof data.hackclub_oauth_configured === 'boolean') {
            setHackClubAvailable(data.hackclub_oauth_configured)
          }
          setLoading(false)
        } else {
          console.error('Error generating fingerprint:', error)
          setLoading(false)
        }
      })

    const updateNowPlaying = () => {
      axios.get('/api/now-playing')
        .then(response => setNowPlaying(response.data.track))
        .catch(() => {})
    }

    updateNowPlaying()
    const interval = setInterval(updateNowPlaying, 3000)

    axios.get('/api/config/public/aura_enabled')
      .then(res => setAuraEnabled(res.data?.value !== 'false'))
      .catch(() => {})

    return () => clearInterval(interval)
  }, [])

  const handleUsernameSubmit = async (e) => {
    e.preventDefault()
    setUsernameError('')
    if (!username.trim()) { setUsernameError('Please enter a username'); return }
    if (username.length > 50) { setUsernameError('Username must be 50 characters or less'); return }
    try {
      const response = await axios.post('/api/fingerprint/generate', { username: username.trim() })
      const data = response.data || {}
      setFingerprintId(data.fingerprint_id)
      setRequiresUsername(data.requires_username || false)
      setRequiresGithubAuth(data.requires_github_auth || false)
      setRequiresHackClubAuth(data.requires_hackclub_auth || false)
      if (typeof data.github_oauth_configured === 'boolean') {
        setGithubAvailable(data.github_oauth_configured)
      }
      if (typeof data.hackclub_oauth_configured === 'boolean') {
        setHackClubAvailable(data.hackclub_oauth_configured)
      }
    } catch (error) {
      setUsernameError(error.response?.data?.error || 'Failed to set username')
    }
  }

  const handleGithubLogin = async () => {
    try {
      const response = await axios.get('/api/github/login')
      window.location.href = response.data.authUrl
    } catch (error) {
      console.error('GitHub login error:', error)
    }
  }

  const handleHackClubLogin = async () => {
    try {
      const response = await axios.get('/api/hackclub/login')
      window.location.href = response.data.authUrl
    } catch (error) {
      console.error('Hack Club login error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Music className="h-5 w-5 animate-pulse" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  const missingAuthProviders = [
    requiresGithubAuth ? 'GitHub' : null,
    requiresHackClubAuth ? 'Hack Club' : null
  ].filter(Boolean)

  if (missingAuthProviders.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Authentication Required</CardTitle>
            <p className="text-muted-foreground mt-2">
              Sign in with {missingAuthProviders.join(' and ')} to continue queueing songs.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthError && (
              <p className="text-sm text-destructive text-center">{oauthError}</p>
            )}

            {requiresGithubAuth && (
              githubAvailable ? (
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGithubLogin}>
                  <Github className="h-4 w-4" />
                  Continue with GitHub
                </Button>
              ) : (
                <p className="text-sm text-destructive text-center">
                  GitHub auth is required but GitHub OAuth is not configured.
                </p>
              )
            )}

            {requiresHackClubAuth && (
              hackClubAvailable ? (
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleHackClubLogin}>
                  <Shield className="h-4 w-4" />
                  Continue with Hack Club
                </Button>
              ) : (
                <p className="text-sm text-destructive text-center">
                  Hack Club auth is required but Hack Club OAuth is not configured.
                </p>
              )
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (requiresUsername) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Music className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to SpotiQueue</CardTitle>
            <p className="text-muted-foreground mt-2">Enter your name to start queueing songs</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name"
                maxLength={50}
                autoFocus
              />
              {usernameError && (
                <p className="text-sm text-destructive">{usernameError}</p>
              )}
              <Button type="submit" className="w-full">Continue</Button>
              {(githubAvailable || hackClubAvailable) && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  {githubAvailable && (
                    <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGithubLogin}>
                      <Github className="h-4 w-4" />
                      Sign in with GitHub
                    </Button>
                  )}
                  {hackClubAvailable && (
                    <Button type="button" variant="outline" className="w-full gap-2" onClick={handleHackClubLogin}>
                      <Shield className="h-4 w-4" />
                      Sign in with Hack Club
                    </Button>
                  )}
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">SpotiQueue</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main
        className="max-w-7xl mx-auto px-4 sm:px-6 py-6"
        style={auraColor ? {
          background: `radial-gradient(ellipse 80% 40% at 20% 0%, rgba(${auraColor}, 0.12) 0%, transparent 70%)`
        } : {}}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <div className="space-y-6">
            <NowPlaying track={nowPlaying} auraColor={auraColor} />
            <QueueForm
              fingerprintId={fingerprintId}
              onQueued={(trackId) => setMyTrackId(trackId)}
            />
          </div>
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Queue fingerprintId={fingerprintId} myTrackId={myTrackId} />
          </div>
        </div>
      </main>
    </div>
  )
}

function AdminPage() {
  const [activeTab, setActiveTab] = useState('spotify')
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    axios.get('/api/admin/stats').catch(error => {
      if (error.response?.status === 401) setAuthError(true)
    })
  }, [])

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-destructive">Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Please enter your admin credentials when prompted.</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">SpotiQueue Admin</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex overflow-x-auto">
            <TabsTrigger value="spotify">Spotify</TabsTrigger>
            <TabsTrigger value="prequeue">Prequeue</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="banned">Banned</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>
          <div className="mt-6">
            <TabsContent value="spotify"><SpotifyConnect /></TabsContent>
            <TabsContent value="prequeue"><PrequeueManagement /></TabsContent>
            <TabsContent value="queue"><QueueManagement /></TabsContent>
            <TabsContent value="devices"><DeviceManagement /></TabsContent>
            <TabsContent value="banned"><BannedTracks /></TabsContent>
            <TabsContent value="config"><Configuration /></TabsContent>
            <TabsContent value="stats"><Stats /></TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ClientPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/display" element={<Display />} />
      </Routes>
      <Toaster />
    </Router>
  )
}

export default App
