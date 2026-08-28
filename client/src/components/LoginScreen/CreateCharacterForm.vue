<template>
  <div class="parchment">
    <div class="parchment-inner">
      <div class="create-intro">
        <span class="create-intro-line">第一纪元的低语正在低唤</span>
        <span class="create-intro-name">当前血脉进阶之路</span>
      </div>

      <!-- 三族试听（拆到 RaceSelector 子组件） -->
      <RaceSelector
        :selected-race="selectedRace"
        @select-race="onSelectRace"
      />

      <!-- 真名铭刻 -->
      <div class="field">
        <label class="field-label">✦ 在卷轴上刻下你的真名</label>
        <div
          class="field-row"
          :class="{
            'is-focus': focusField === 'char',
            'is-valid': charNameInput.trim().length >= 2,
            'is-warn': charNameInput.length > 0 && charNameInput.trim().length < 2,
          }"
        >
          <input
            :value="charNameInput"
            class="parchment-input"
            placeholder="2 ~ 12 个字符，不可与他人重复"
            maxlength="12"
            @input="onCharNameInput"
            @focus="focusField = 'char'"
            @blur="focusField = ''"
            @keyup.enter="$emit('create')"
          />
          <span class="field-icon field-icon--astrolabe" aria-hidden="true">
            <template v-if="charNameInput.trim().length >= 2">✓</template>
            <template v-else-if="charNameInput.length > 0">✗</template>
            <template v-else>✧</template>
          </span>
        </div>
        <p
          class="field-hint"
          :class="{
            'is-valid': charNameInput.trim().length >= 2,
            'is-invalid': charNameInput.length > 0 && charNameInput.trim().length < 2,
          }"
          v-if="charNameInput.length > 0"
        >
          <template v-if="charNameInput.trim().length >= 2">真名可为你刻入命运之书</template>
          <template v-else>真名至少 2 个字符</template>
        </p>
      </div>

      <!-- 命运之书预览（永远落档「鹰人」，上方预览不影响） -->
      <div class="fate-book" aria-hidden="true">
        <div class="fate-book-line"></div>
        <span class="fate-book-text">
          <template v-if="charNameInput.trim().length >= 2">
            [ <span class="fate-book-name">{{ charNameInput.trim() }}</span> ，{{ actualRaceName }} ]
          </template>
          <template v-else>
            [ ______________ ，{{ actualRaceName }} ]
          </template>
        </span>
        <div class="fate-book-line"></div>
      </div>

      <div class="parchment-actions">
        <button
          class="btn-rune btn-rune--primary"
          @click="$emit('create')"
          :disabled="charNameInput.trim().length < 2"
        >
          <span class="btn-rune-flame"></span>
          <span class="btn-rune-text">⚔ 踏入费兰德</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== 创建角色子组件 ======
// @file components/LoginScreen/CreateCharacterForm
// @module login-screen-create-character-form
// @description 真名铭刻 + 命运之书预览 + 提交；三族试听拆分到 RaceSelector
import { ref } from 'vue';
import RaceSelector from './RaceSelector.vue';
import { races } from './races.js';

const props = defineProps({
  selectedRace: { type: String, default: 'eagle' },
  charNameInput: { type: String, default: '' },
});
const emit = defineEmits([
  'update:selectedRace',
  'update:charNameInput',
  'create',
]);

const focusField = ref('');

function onCharNameInput(e) {
  emit('update:charNameInput', e.target.value);
}
function onSelectRace(id) {
  // 三族试听只影响 selectedRace；actualRace 永远是 eagle（落档）
  emit('update:selectedRace', id);
}

// 真名落档的种族 = 永远是鹰人（翼人/天使要 Lv.30/80 才能进化）
const actualRaceName = races.find(r => r.id === 'eagle').name;
</script>

<!-- 父壳样式通过 :deep() 透传（field / fate-book / create-intro / btn-rune / parchment / etc.） -->
