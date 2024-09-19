import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store";

interface Data {
  email: string;
  username: string;
}
type CreateUserParams = {
  baseUrl: string;
  email: string;
  username: string;
  password: string;
};

const SignUp = () => {
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
  });
  const navigate = useNavigate();
  const { mutate: createUser, isPending } = useMutation({
    mutationFn: async (params: CreateUserParams) => {
      const { baseUrl, email, username, password } = params;
      const { data } = await axios.post(
        `${baseUrl}/auth/signup`,
        {
          email,
          username,
          password,
        },
        { withCredentials: true }
      );
      return data as Data;
    },
    onSuccess: (data) => {
      useUserStore.setState({ email: data.email, username: data.username });
      navigate("/home");
    },
    onError: (error) => {
      console.error(error);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseUrl = import.meta.env.VITE_SERVER_URL;
    const { email, username, password } = formData;
    createUser({ baseUrl, email, username, password });
  };

  return (
    <div>
      <h1>SignUp</h1>
      <p>Welcome to the sign up page!</p>

      <form onSubmit={handleSignUp}>
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          onChange={handleChange}
          value={formData.email}
        />

        <label htmlFor="username">Username:</label>
        <input
          type="text"
          id="username"
          name="username"
          required
          onChange={handleChange}
          value={formData.username}
        />

        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          name="password"
          required
          onChange={handleChange}
          value={formData.password}
        />

        <button type="submit">Sign Up</button>
      </form>
    </div>
  );
};

export default SignUp;
