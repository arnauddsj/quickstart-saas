<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { trpc } from "@/services/server";
import { useUserStore } from "@/stores/user";
import ErrorMessage from "@/components/ErrorMessage.vue";

const email = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const sendMagicLink = async () => {
  try {
    await trpc.auth.sendMagicLink.mutate({ email: email.value });
    successMessage.value = "Magic link sent! Check your email.";
    errorMessage.value = "";
  } catch (error) {
    errorMessage.value = "Error sending magic link. Please try again.";
    successMessage.value = "";
  }
};

onMounted(async () => {
  const token = route.query.token as string;
  if (token) {
    try {
      const result = await trpc.auth.verifyToken.mutate({ token });
      userStore.setUser(result.email);
      router.push("/");
    } catch (error) {
      errorMessage.value = "Invalid or expired token. Please try again.";
      await userStore.logout();
    }
  }
});
</script>

<template>
  <div class="container">
    <h1>Login</h1>
    <form @submit.prevent="sendMagicLink">
      <input v-model="email" type="email" placeholder="Enter your email" required />
      <button type="submit">Login with my email</button>
    </form>
    <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
    <ErrorMessage v-if="errorMessage" :message="errorMessage" />
  </div>
</template>

<style scoped lang="scss">
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

form {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

input {
  flex-grow: 1;
  border: 1px solid var(--primary-color15);
  border-radius: var(--border-radius);
  padding: 0.6em 1.2em;
  font-size: 1em;
}

button {
  padding: 0.6em 1.2em;
  font-size: 1em;
}

.success-message {
  color: green;
  margin-top: 1rem;
}
</style>
