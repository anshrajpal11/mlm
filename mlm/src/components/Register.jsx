import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    sponsor_code: '',
    position: 'left'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(`Registration successful! Your member code is: ${data.member_code}`)
        setError('')
        // Reset form
        setFormData({
          name: '',
          email: '',
          mobile: '',
          password: '',
          sponsor_code: '',
          position: 'left'
        })
      } else {
        setError(data.error)
        setSuccess('')
      }
    } catch (error) {
      setError('Server error')
      setSuccess('')
    }
  }

  return (
    <div className="register-container">
      <h2>Member Registration</h2>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Mobile:</label>
          <input
            type="text"
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Sponsor Code:</label>
          <input
            type="text"
            name="sponsor_code"
            value={formData.sponsor_code}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Position:</label>
          <select name="position" value={formData.position} onChange={handleChange}>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
        <button type="submit">Register</button>
      </form>
      <p>Already have an account? <Link to="/">Login</Link></p>
    </div>
  )
}

export default Register