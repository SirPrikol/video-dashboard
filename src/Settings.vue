<template>
  <div class='settings'>
    <div class='group with-slider'>
      <div class='content'>
        <h5>Размер шрифта подписей камер</h5>
        <slider :min='5' :max='30' :tooltipPlacement='"bottom"'
                :value='settings.fontSize' @change='setFontSize' />
      </div>
      <p class='comment'>
        Эта настройка хранится локально на устройстве.
        Если открыть эту страницу в другом браузере или на другом устройстве, то значение будет
        отличаться.
      </p>
    </div>
    <div class='spacer'></div>
  </div>
</template>

<script>
  import Slider from 'vue-slider-component';
  import 'vue-slider-component/theme/antd.css'
  import { mapState, mapMutations } from 'vuex';

  export default {
    components: {
      Slider
    },
    computed: {
      ...mapState(['cameras', 'settings'])
    },
    methods: {
      ...mapMutations(['setFontSize'])
    }
  };
</script>

<style scoped>
  .comment {
    color: #aaa;
    font-size: 13px;
    font-style: italic;
    margin: 0;
  }

  .comment + .comment {
    margin-top: 7px;
  }

  .spacer {
    flex: 1;
  }

  .settings {
    padding: 0 10px 10px 10px;
  }

  .group {
    border-bottom: 1px dotted #ccc;
    display: flex;
    flex-direction: column;
    padding: 6px;
  }

  .group > .content {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: row;
    padding: 5px 0;
  }

  .group > .content > h5 {
    font-weight: 500;
    font-size: 14px;
    margin: 0;
    min-width: 250px;
  }

  .group.top-align > .content {
    align-items: flex-start;
  }

  .camera-list {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .camera-list > label {
    min-width: 100px;
  }

  .group > .content > :not(h5) {
    flex: 1;
    min-width: 200px;
  }
</style>
