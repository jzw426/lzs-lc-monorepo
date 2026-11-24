{
  "_$ver": 1,
  "_$id": "r03main1",
  "_$type": "Scene",
  "left": 0,
  "right": 0,
  "top": 0,
  "bottom": 0,
  "name": "Main",
  "width": 750,
  "height": 1334,
  "_$child": [
    {
      "_$id": "r03bg001",
      "_$type": "Box",
      "name": "Background",
      "x": 0,
      "y": 0,
      "width": 750,
      "height": 1334,
      "bgColor": "#101014"
    },
    {
      "_$id": "r03gr001",
      "_$type": "Sprite",
      "name": "GameRoot",
      "x": 0,
      "y": 0,
      "width": 750,
      "height": 1334,
      "_$comp": [
        {
          "_$type": "3c9e7b21-5d4a-4f18-a7c3-9b6e2d8f1a40",
          "scriptPath": "../src/GameScene.ts",
          "text": ""
        }
      ],
      "_$child": [
        {
          "_$id": "r03ui001",
          "_$type": "Sprite",
          "name": "UIRoot",
          "x": 0,
          "y": 0,
          "width": 750,
          "height": 1334,
          "_$child": [
            {
              "_$id": "r03st001",
              "_$type": "Text",
              "name": "StatusText",
              "x": 40,
              "y": 80,
              "width": 670,
              "height": 300,
              "text": "",
              "font": "Arial",
              "fontSize": 26,
              "color": "#f2f2f2",
              "leading": 8,
              "align": "left",
              "valign": "top"
            },
            {
              "_$id": "r03ab001",
              "_$type": "Sprite",
              "name": "ActionBar",
              "x": 40,
              "y": 440,
              "width": 670,
              "height": 80,
              "_$child": [
                {
                  "_$id": "r03lb001",
                  "_$type": "Text",
                  "name": "LoginButton",
                  "x": 0,
                  "y": 0,
                  "width": 150,
                  "height": 60,
                  "text": "登录",
                  "font": "Arial",
                  "fontSize": 26,
                  "color": "#ffffff",
                  "bgColor": "#2a2a33",
                  "align": "center",
                  "valign": "middle"
                },
                {
                  "_$id": "r03ad001",
                  "_$type": "Text",
                  "name": "AdButton",
                  "x": 180,
                  "y": 0,
                  "width": 150,
                  "height": 60,
                  "text": "广告",
                  "font": "Arial",
                  "fontSize": 26,
                  "color": "#ffffff",
                  "bgColor": "#2a2a33",
                  "align": "center",
                  "valign": "middle"
                },
                {
                  "_$id": "r03sb001",
                  "_$type": "Text",
                  "name": "ShareButton",
                  "x": 360,
                  "y": 0,
                  "width": 150,
                  "height": 60,
                  "text": "分享",
                  "font": "Arial",
                  "fontSize": 26,
                  "color": "#ffffff",
                  "bgColor": "#2a2a33",
                  "align": "center",
                  "valign": "middle"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
