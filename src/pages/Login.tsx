import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store";

interface Data {
  email: string;
  username: string;
}

type LoginUserParams = {
  baseUrl: string;
  body:
    | {
        email: string;
        password: string;
      }
    | {
        username: string;
        password: string;
      };
};

const Login = () => {
  const [formData, setFormData] = useState({
    emailOrUsername: "",
    password: "",
  });
  const navigate = useNavigate();
  const {
    mutate: loginUser,
    isPending,
    data,
  } = useMutation({
    mutationFn: async (params: LoginUserParams) => {
      const { baseUrl, body } = params;
      const { data } = await axios.post(`${baseUrl}/auth/login`, body, {
        withCredentials: true,
      });
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseUrl = import.meta.env.VITE_SERVER_URL;
    const emailRegex = /^[a-zA-Z0-9._]+@[a-zA-Z0-9]+\.[A-Za-z]+$/;
    const body = emailRegex.test(formData.emailOrUsername)
      ? { email: formData.emailOrUsername, password: formData.password }
      : { username: formData.emailOrUsername, password: formData.password };

    loginUser({ baseUrl, body });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };
  return (
    <div>
      <h1>Login</h1>
      <p>Welcome to the login page!</p>

      <form onSubmit={handleLogin}>
        <label htmlFor="emailOrUsername">Enter email or username: </label>
        <input
          type="text"
          id="emailOrUsername"
          name="emailOrUsername"
          required
          onChange={handleChange}
          value={formData.emailOrUsername}
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

        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Login;
