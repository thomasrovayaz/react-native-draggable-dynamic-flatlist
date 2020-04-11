# react-native-draggable-dynamic-flatlist
A react native component that lets you drag and drop dynamic items of a FlatList. Inspired by [react-native-draggable-flatlist](https://github.com/computerjazz/react-native-draggable-flatlist)

![Draggable FlatList demo](https://media.giphy.com/media/hsDWdbGYx1gtStn1y3/giphy.gif)

## Install

1. `npm install react-native-draggable-dynamic-flatlist` or `yarn add react-native-draggable-dynamic-flatlist`
2. `import DraggableFlatList from 'react-native-draggable-dynamic-flatlist'`  

## Api

### Props
All props are spread onto underlying [FlatList](https://facebook.github.io/react-native/docs/flatlist)

Name | Type | Description
:--- | :--- | :---
`data` | Array | Items to be rendered.
`horizontal` | Boolean | Orientation of list.
`renderItem` | Function | `({ item, index, move, moveEnd, isActive }) => <Component />`. Call `move` when the row should become active (in an `onPress`, `onLongPress`, etc). Call `moveEnd` when the gesture is complete (in `onPressOut`).
`keyExtractor` | Function | `(item, index) => string`
`scrollPercent` | Number | Sets where scrolling begins. A value of `5` will scroll up if the finger is in the top 5% of the FlatList container and scroll down in the bottom 5%. 
`scaleSelectionFactor` | Number | Sets the scale factor of the selected item. 
`onMoveEnd` | Function | `({ data, to, from, row }) => void` Returns updated ordering of `data` 
`onMoveBegin` | Function | `(index) => void` Called when row becomes active.
`spacerStyle` | View.style | Style of the spacer when an item is moved (ghost view)
`removeClippedSubviews` | Boolean | Improve scroll performance for large lists. May have bugs (missing content) in some circumstances (Default `false`)

## Example

```javascript
import React, { Component } from 'react'
import { View, TouchableOpacity, Text } from 'react-native'
import DraggableFlatList from 'react-native-draggable-dynamic-flatlist'

class Example extends Component {

  state = {
    data: [...Array(20)].map((d, index) => ({
      key: `item-${index}`,
      label: index,
      backgroundColor: `rgb(${Math.floor(Math.random() * 255)}, ${index * 5}, ${132})`,
    }))
  }

  renderItem = ({ item, index, move, moveEnd, isActive }) => {
    return (
      <TouchableOpacity
        style={{ 
          height: 100, 
          backgroundColor: isActive ? 'blue' : item.backgroundColor,
          alignItems: 'center', 
          justifyContent: 'center' 
        }}
        onLongPress={move}
        onPressOut={moveEnd}>
        <Text style={{ 
          fontWeight: 'bold', 
          color: 'white',
          fontSize: 32,
        }}>{item.label}</Text>
      </TouchableOpacity>
    )
  }

  render() {
    return (
      <View style={{ flex: 1 }}>
        <DraggableFlatList
          data={this.state.data}
          renderItem={this.renderItem}
          keyExtractor={(item, index) => `draggable-item-${item.key}`}
          scrollPercent={5}
          onMoveEnd={({ data }) => this.setState({ data })}
        />
      </View>
    )
  }
}

export default Example
```
## Main differences with react-native-draggable-flatlist

react-native-draggable-flatlist is good but it doesn't work when item's sizes are changing. The positions (x and y) are not calculated properly. It's using measure functions which doesn't work perfectly on react-native, lot of unsolvable bugs (especially on android). Also, the measure function doesn't work when the item is hidden on a flatlist (out of the screen), so if you have big items, it doesn't work really well.
The whole measuring system has been refactored by calculating all the positions manually.
This library is using the onLayout property on each item and scrollview which makes it more stable with dynamic content. onLayout works perfectly on react-native and there is no more problem with dynamic content.
