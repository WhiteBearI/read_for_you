

<script setup>
import { ref, onMounted } from 'vue';

import IndexPage from './components/IndexPage.vue';
import ReadingPage from './components/ReadingPage.vue';
import AIChat from './components/AIChat/AIChat.vue';

function getPageFromHash() {
  const hash = window.location.hash.toLowerCase();
  if (hash.startsWith('#/aichat')) return 'aichat';
  if (hash.startsWith('#/reading')) return 'reading';
  return 'index';
}

const currentPage = ref(getPageFromHash());
function onHashChange() {
  currentPage.value = getPageFromHash();
}

onMounted(() => {
  window.addEventListener('hashchange', onHashChange);
});
</script>



<template>
  <IndexPage v-if="currentPage === 'index'" />
  <ReadingPage v-else-if="currentPage === 'reading'" />
  <AIChat v-else-if="currentPage === 'aichat'" />
</template>


<style scoped>
</style>
