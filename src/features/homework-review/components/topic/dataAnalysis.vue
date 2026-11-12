<!-- 数据研判 -->
<template>
  <div class="topic_title_content">
    <div :id="'box_' + quesData.ypstid">
      <el-row>
        <el-col :span="22">
          <p class="tm_title">
            {{ quesData.sx }}. 考试题目：{{ quesData.kstm }}（本题{{
              quesData.fs
            }}分）
          </p>
          <ul class="answerBox">
            <li
              class="answer_item"
              v-for="(ksFile, ksIndex) in quesData.sjypStfjs"
              :key="ksIndex + 'questionData'"
            >
              <p>
                {{ ksFile.sjbmc }}
                <a
                  @click="downloadFile(ksFile.sjbmc, ksFile.sjbdz)"
                  class="downLoadBtn"
                  >下载</a
                >
              </p>
            </li>
          </ul>
          <p class="ms_title">题目描述：{{ quesData.tmms }}</p>
          <p class="ksda_title">
            <span class="font_weight">考生答案：</span>{{ danr }}
          </p>
          <ul class="answerBox">
            <li
              class="answer_item"
              v-for="(ksFile, ksIndex) in quesData.sjypKsjgfjs"
              :key="ksIndex + 'questionData'"
            >
              <p v-if="ksFile.dnmc">
                {{ ksFile.dnmc }}
                <a
                  @click="downloadFile(ksFile.dnmc, ksFile.dndz)"
                  class="downLoadBtn"
                  >下载</a
                >
              </p>
            </li>
          </ul>
        </el-col>

        <el-col :span="2"
          ><el-input
            v-if="source != 'examPaper'"
            class="fs_input"
            v-model="quesData.df"
            placeholder="请输入分值"
            clearable
            @clear="handleChangedf"
            @keyup.enter.native="enter"
            @blur="handleChangedf"
            :disabled="type === 'detail'"
            oninput="value=value.replace(/[^\d.]/g,'')"
          ></el-input>
        </el-col>
      </el-row>
      <template v-if="source != 'examPaper'">
        <div
          class="topic_select_item"
          v-for="(item, index) in quesData.sjypStfjs"
          :key="index"
        >
          <p>
            {{ item.dnmc }}

            <a
              v-if="item.fileType && item.fileType === 'excel'"
              :href="item.url"
              class="downLoadBtn"
              >下载</a
            >
          </p>
          <PdfViewComponent
            v-if="item.url && item.fileType === 'application/pdf'"
            class="contentView"
            :pdfUrl="item.url"
            pdfName=""
          ></PdfViewComponent>
          <img
            v-if="
              item.url && item.fileType && item.fileType.indexOf('image') != -1
            "
            class="contentView"
            :src="item.url"
            alt=""
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { throttle } from "echarts"
import PdfViewComponent from "@/views/component/PdfViewComponent.vue"
import { showFile } from "@/api/common.js"
import { showFileType } from "@/utils/tools.js"
export default {
  components: { PdfViewComponent },
  props: {
    topicData: {
      type: Object,
      default: () => {}
    },
    type: {
      type: String,
      default: ""
    },
    source: {
      type: String,
      default: ""
    }
  },
  computed: {
    quesData() {
      return this.topicData
    },
    danr() {
      if (this.quesData.sjypKsjgfjs) {
        return this.quesData.sjypKsjgfjs.filter((item) => item.dndz == null)[0]
          .danr
      } else {
        return ""
      }
    }
  },
  data() {
    return {
      urlMap: {},
      // eslint-disable-next-line no-undef
      baseUrl: baseUrl
    }
  },
  created() {
    this.quesData.sjypStfjs.forEach((item, index) => {
      if (item.danr) {
        this.quesData.danr = item.danr
      }
      if (item.dndz && item.dnmc) {
        this.downloadKsdnFile(item, index)
      }
    })
  },
  methods: {
    handleChangedf() {
      if (this.quesData.df) {
        if (Number(this.quesData.df) > Number(this.quesData.fs)) {
          this.quesData.df = ""
        }
      }
      this.$emit("changetmldzzf")
    },
    enter(e) {
      e.target.blur()
    },
    async downloadKsdnFile(item, index) {
      if (this.source === "examPaper") {
        return
      }
      this.$set(
        this.quesData.sjypStfjs[index],
        "url",
        showFile({ filePath: item.dndz, fileName: item.dnmc })
      )
      this.$set(
        this.quesData.sjypStfjs[index],
        "fileType",
        showFileType(item.dnmc)
      )
    },
    downloadFile: throttle(async function (wjmc, wjdz) {
      const elink = document.createElement("a")
      elink.href =
        // eslint-disable-next-line no-undef
        baseUrl +
        `/download/showOrDownloadFile?filePath=${wjdz}&fileName=${wjmc}`
      elink.download = wjmc
      elink.style.display = "none"
      document.body.appendChild(elink)
      elink.click()
      URL.revokeObjectURL(elink.href)
      document.body.removeChild(elink)
    }, 2000)
  },
  watch: {
    quesData: {
      handler(newVal) {
        this.quesData = newVal
        this.quesData.sjypStfjs.forEach((item, index) => {
          this.downloadKsdnFile(item, index)
        })
      }
    }
  }
}
</script>
<style lang="less" scoped>
.topic_title_content {
  margin-top: 20px;
  .tm_title {
    font-family: PingFangSC-Medium;
    display: inline-block;
    font-size: 16px;
    color: #333333;
    letter-spacing: 0;
    line-height: 28px;
    font-weight: 600;
    margin: 0;
  }
  .ms_title {
    margin: 0;
    font-size: 16px;
    color: #666666;
    letter-spacing: 0;
    line-height: 28px;
    font-weight: 400;
  }
  .ksda_title {
    font-size: 14px;
    color: #333333;
    .font_weight {
      font-weight: 600;
    }
  }
  .topic_select_item {
    font-size: 14px;
    color: #333333;
    letter-spacing: 0;
    line-height: 14px;
    font-weight: 400;
    .contentView {
      // max-height: 800px;
      // overflow: auto;
      max-width: 600px;
      margin: auto;
      display: block;
    }
  }
}
.fs_input {
  /deep/.el-input__inner {
    background: rgba(22, 124, 243, 0.1) !important;
    border-radius: 2px;
    height: 30px;
    border: none !important;
    color: #167cf3 !important;
    &::placeholder {
      color: #167cf3 !important;
    }
  }
}
.downLoadBtn {
  color: #167cf3;
  text-decoration: underline;
}
</style>
