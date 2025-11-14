import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [downline, setDownline] = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      navigate('/')
      return
    }

    setUser(JSON.parse(userData))
    fetchProfile()
    fetchDownline()
  }, [navigate])

  const fetchProfile = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data)
      } else {
        handleLogout()
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchDownline = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/downline', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setDownline(data)
      }
    } catch (error) {
      console.error('Error fetching downline:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/')
  }

  if (!user || !profile) {
    return <div>Loading...</div>
  }

  return (
    <div className="dashboard">
      <header>
        <h1>Welcome, {user.name}</h1>
        <button onClick={handleLogout}>Logout</button>
      </header>

      <nav>
        <button onClick={() => setActiveTab('profile')}>Profile</button>
        <button onClick={() => setActiveTab('downline')}>Downline</button>
      </nav>

      <main>
        {activeTab === 'profile' && (
          <div className="profile">
            <h2>Profile</h2>
            <p><strong>Member Code:</strong> {profile.member_code}</p>
            <p><strong>Name:</strong> {profile.name}</p>
            <p><strong>Email:</strong> {profile.email}</p>
            <p><strong>Mobile:</strong> {profile.mobile}</p>
            <p><strong>Sponsor Code:</strong> {profile.sponsor_code}</p>
            <p><strong>Left Count:</strong> {profile.left_count}</p>
            <p><strong>Right Count:</strong> {profile.right_count}</p>
          </div>
        )}

        {activeTab === 'downline' && downline && (
          <div className="downline">
            <h2>Downline Members</h2>
            <div className="downline-section">
              <h3>Left Leg ({downline.left.length} members)</h3>
              <ul>
                {downline.left.map(member => (
                  <li key={member.id}>
                    {member.name} ({member.member_code})
                  </li>
                ))}
              </ul>
            </div>
            <div className="downline-section">
              <h3>Right Leg ({downline.right.length} members)</h3>
              <ul>
                {downline.right.map(member => (
                  <li key={member.id}>
                    {member.name} ({member.member_code})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Dashboard