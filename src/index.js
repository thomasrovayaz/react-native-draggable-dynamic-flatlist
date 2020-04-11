import React, { Component } from 'react'
import {
    YellowBox,
    Animated,
    FlatList,
    View,
    PanResponder,
    UIManager,
    StyleSheet,
} from 'react-native'

// Measure function triggers false positives
YellowBox.ignoreWarnings(['Warning: isMounted(...) is deprecated']);
UIManager.setLayoutAnimationEnabledExperimental && UIManager.setLayoutAnimationEnabledExperimental(true);

const initialState = {
    hoverComponent: null,
    extraData: null,
};

class DraggableFlatList extends Component {
    _moveAnim = new Animated.Value(0);
    _offset = new Animated.Value(0);
    _hoverAnim = Animated.add(this._moveAnim, this._offset);

    _spacerIndex = -1;
    _previousIndex = -1;
    _nextIndex = -1;

    _tappedRow = -1;
    _tappedRowSize = 0;

    _scrollOffset = 0;
    _containerSize;
    _containerOffset;
    _headerSize = 0;

    _move = 0;
    _hasMoved = false;
    _additionalOffset = 0;
    _releaseVal = 0;
    _releaseAnim = null;

    _currentEvent = null;
    _container = null;
    _spacerLayout = null;

    _size = [];
    _position = [];
    _order = [];

    constructor(props) {
        super(props);

        const { data } = this.props;
        for (let i = 0; i < data.length; i++) {
            this._order[i] = i;
        }

        this._panResponder = PanResponder.create({
            onStartShouldSetPanResponderCapture: (evt, {numberActiveTouches}) => {
                if (numberActiveTouches > 1) {
                    return true;
                }
                evt.persist();
                this._currentEvent = evt;
                return false
            },
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                const { horizontal } = this.props;
                const { moveX, moveY, numberActiveTouches } = gestureState;
                const move = horizontal ? moveX : moveY;
                if (numberActiveTouches > 1) {
                    this.onRelease();
                    return false;
                }
                const shouldSet = this._tappedRow > -1;
                if (shouldSet) {
                    this._moveAnim.setValue(move);
                    this.animate();
                    this._hasMoved = true
                }
                return shouldSet;
            },
            onPanResponderMove: (evt, gestureState) => {
                if (gestureState.numberActiveTouches > 1) {
                    this.onRelease();
                    return;
                }
                Animated.event([null, { [props.horizontal ? 'moveX' : 'moveY']: this._moveAnim }], {
                    listener: (evt, gestureState) => {
                        const { moveX, moveY } = gestureState;
                        const { horizontal } = this.props;
                        this._move = horizontal ? moveX : moveY;
                    }
                })(evt, gestureState)
            },
            onPanResponderTerminationRequest: ({ nativeEvent }, gestureState) => {
                return false;
            },
            onPanResponderRelease: this.onRelease
        });
        this.state = initialState
    }

    componentDidUpdate = (prevProps, prevState) => {
        if (prevProps.extraData !== this.props.extraData) {
            this.setState({ extraData: this.props.extraData })
        }
    };

    initPositions = () => {
        let currentPos = this._containerOffset + this._headerSize;
        for (let i = 0; i < this._order.length; i++) {
            const index = this._order[i];
            if (this._size[index] > 0) {
                this._position[index] = currentPos;
                currentPos += this._size[index];
                if (index === this._tappedRow) {
                    this._position[index] = -1;
                }
            }
        }
    };

    onRelease = () => {
        if (this._currentEvent === null) return;
        this._currentEvent = null;
        if (this._tappedRow === -1) return;

        const { horizontal } = this.props;
        const { pageX, pageY, scrollOffset } = this._spacerLayout;
        const position = horizontal ? pageX : pageY - this._scrollOffset + scrollOffset;
        this._releaseVal = position - (this._containerOffset);
        if (this._releaseAnim) this._releaseAnim.stop();
        this._releaseAnim = Animated.parallel([
            // after decay, in parallel:
            Animated.spring(this._offset, {
                toValue: 0,
                stiffness: 5000,
                damping: 500,
                mass: 3,
                useNativeDriver: true,
            }),
            Animated.spring(this._moveAnim, {
                toValue: this._releaseVal,
                stiffness: 5000,
                damping: 500,
                mass: 3,
                useNativeDriver: true,
            }),
        ]);

        this._releaseAnim.start(this.onReleaseAnimationEnd)
    };

    move = (hoverComponent, index) => {
        const { onMoveBegin, data } = this.props;
        if (this._releaseAnim) {
            this._releaseAnim.stop();
            this.onReleaseAnimationEnd();
            return
        }

        for (let i = 0; i < data.length; i++) {
            this._order[i] = i;
        }
        this.initPositions();

        this._tappedRow = index;
        this._spacerIndex = index;
        this._nextIndex = this._spacerIndex + 1;
        this._previousIndex = this._spacerIndex - 1;

        if (this._currentEvent && this._currentEvent.nativeEvent) {
            const { pageX, pageY } = this._currentEvent.nativeEvent;
            const { horizontal } = this.props;
            this._tappedRowSize = this._size[this._tappedRow];
            const position = this._position[this._tappedRow] - this._scrollOffset;
            this._position[this._tappedRow] = -1;
            if (this._tappedRow === -1) {
                return false;
            }
            const tappedPixel = horizontal ? pageX : pageY;
            this._moveAnim.setValue(tappedPixel);
            this._move = tappedPixel;
            this._additionalOffset = position - tappedPixel - (this._containerOffset);
            this._offset.setValue(this._additionalOffset);
            this.getSpacerIndex(tappedPixel);
            this.setState({
                    hoverComponent,
                }, () => onMoveBegin && onMoveBegin(index)
            );
        }
    };

    animate = () => {
        const { scrollPercent, scrollSpeed } = this.props;
        const scrollRatio = scrollPercent / 100;
        if (this._tappedRow === -1) return;
        const shouldScrollUp = this._move - this._containerOffset < (this._containerSize * scrollRatio);
        const shouldScrollDown = this._move - this._containerOffset > (this._containerSize * (1 - scrollRatio));
        if (shouldScrollUp) this.scroll(-scrollSpeed, this._spacerIndex);
        else if (shouldScrollDown) this.scroll(scrollSpeed, this._spacerIndex);
        this.getSpacerIndex(this._move);

        requestAnimationFrame(this.animate)
    };

    scroll = (scrollAmt, spacerIndex) => {
        if (spacerIndex === -1) return;
        const newOffset = this._scrollOffset + scrollAmt;
        const offset = Math.max(0, newOffset);
        this._flatList.scrollToOffset({ offset, animated: false })
    };

    getSpacerIndex = (move) => {
        const { data } = this.props;
        const spacerIndex = this._order[this._spacerIndex];
        const previousIndex = this._order[this._previousIndex];
        const nextIndex = this._order[this._nextIndex];

        const sizePrevious = this._size[previousIndex];
        const positionPrevious = this._position[previousIndex];
        const sizeNext = this._size[nextIndex];
        const positionNext = this._position[nextIndex];

        if (!sizePrevious || sizePrevious <= 0 || !positionPrevious || positionPrevious <= 0) {
            this._previousIndex = this._previousIndex - 1;
            if (this._previousIndex < 0) {
                this._previousIndex = this._spacerIndex - 1;
                if (!this._noPrevious) {
                    this._noPrevious = true;
                    this.forceUpdate();
                }
            }
        } else {
            if (positionPrevious >= 0) {
                this._noPrevious = false;
                if (move + this._scrollOffset < (positionPrevious + (sizePrevious / 2))) {

                    this._order[this._spacerIndex] = previousIndex;
                    this._order[this._previousIndex] = spacerIndex;

                    this._spacerIndex = this._previousIndex;
                    this._previousIndex = this._spacerIndex - 1;
                    this._nextIndex = this._previousIndex + 1;

                    let found = false;
                    for (let i = this._previousIndex; i >= 0; i--) {
                        const nextIndexTest = this._order[i];
                        const sizePreviousTest = this._size[nextIndexTest];
                        if (sizePreviousTest > 0 && nextIndexTest !== this._tappedRow) {
                            found = true;
                        }
                    }
                    this._noNext = false;
                    this._noPrevious = !found;
                    this.forceUpdate();
                    return;
                }
            }
        }

        if (!sizeNext || sizeNext <= 0 || !positionNext || positionNext <= 0) {
            this._nextIndex = this._nextIndex + 1;
            if (this._nextIndex >= data.length) {
                this._nextIndex = this._spacerIndex + 1;
                if (!this._noNext) {
                    this._noNext = true;
                    this.forceUpdate();
                }
            }
        } else {
            if (positionNext >= 0) {
                this._noNext = false;
                if (move + this._scrollOffset > (positionNext + (sizeNext / 2))) {

                    this._order[this._spacerIndex] = nextIndex;
                    this._order[this._nextIndex] = spacerIndex;
                    this._spacerIndex = this._nextIndex;
                    this._nextIndex = this._spacerIndex + 1;
                    this._previousIndex = this._nextIndex - 1;

                    let found = false;
                    for (let i = this._nextIndex; i < data.length; i++) {
                        const nextIndexTest = this._order[i];
                        const sizeNextTest = this._size[nextIndexTest];
                        if (sizeNextTest > 0 && nextIndexTest !== this._tappedRow) {
                            found = true;
                        }
                    }
                    this._noPrevious = false;
                    this._noNext = !found;
                    this.forceUpdate();
                    return;
                }
            }
        }
    };

    onReleaseAnimationEnd = () => {
        const { data, onMoveEnd } = this.props;
        const tappedRowSave = this._tappedRow;
        const from = this._tappedRow;
        const to = this._spacerIndex;
        const sortedData = this.arrayMove([...data], from, to);
        this._size = this.arrayMove(this._size, from, to);
        for (let i = 0; i < data.length; i++) {
            this._order[i] = i;
        }
        this._moveAnim.setValue(this._releaseVal);
        this._spacerIndex = -1;
        this._nextIndex = -1;
        this._previousIndex = -1;
        this._tappedRow = -1;
        this._hasMoved = false;
        this._move = 0;
        this._releaseAnim = null;

        this.initPositions();
        this.setState(initialState, () => {
            onMoveEnd && onMoveEnd({
                row: data[tappedRowSave],
                from,
                to,
                data: sortedData,
            })
        })
    };

    arrayMove = (arr, old_index, new_index) => {
        if (new_index >= arr.length) {
            let k = new_index - arr.length + 1;
            while (k--) {
                arr.push(undefined);
            }
        }
        arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
        return arr;
    };

    moveEnd = () => {
        if (!this._hasMoved) {
            this._moveAnim.setValue(0);
            this._spacerIndex = -1;
            this._nextIndex = -1;
            this._previousIndex = -1;
            this._tappedRow = -1;
            this._hasMoved = false;
            this._move = 0;
            this._releaseAnim = null;
            this.setState(initialState);
        }
    };

    renderItem = ({ item, index }) => {
        const { renderItem, horizontal, data, spacerStyle } = this.props;
        const _spacerIndex = this._tappedRow === data.length -1? this._spacerIndex-1: this._spacerIndex;
        const isActiveRow = this._tappedRow === index;
        const isSpacerRow = _spacerIndex === index;
        const firstItem = this._noPrevious && this._tappedRow !== -1;

        const spacer = (
            <View
                style={{
                    [horizontal ? 'width' : 'height']: this._tappedRowSize
                }}
                onLayout={e => {
                    this._spacerRef.measure((x, y, width, height, pageX, pageY) => {
                        this._spacerLayout = { x, y, width, height, pageX, pageY, scrollOffset: this._scrollOffset };
                    })
                }}
                ref={(ref) => { this._spacerRef = ref; }}>
                <View style={spacerStyle} />
            </View>
        );

        return (
            <View
                onLayout={e => {
                    if (index !== this._tappedRow) {
                        this._size[index] = e.nativeEvent.layout[horizontal ? 'width' : 'height'] - (((firstItem && index === 0) || (!firstItem && isSpacerRow))? this._tappedRowSize: 0);
                        this.initPositions();
                    }
                }}
                style={[styles.fullOpacity, { flexDirection: horizontal ? 'row' : 'column' }]} >
                {
                    (firstItem && index === 0)? ( spacer ): null
                }
                <RowItem
                    horizontal={horizontal}
                    index={index}
                    isActiveRow={isActiveRow}
                    renderItem={renderItem}
                    item={item}
                    move={this.move}
                    moveEnd={this.moveEnd}
                    extraData={this.state.extraData}
                />
                {
                    (!firstItem && isSpacerRow)? ( spacer ): null
                }
            </View>
        )
    };

    renderHoverComponent = () => {
        const { hoverComponent } = this.state;
        const { horizontal, scaleSelectionFactor } = this.props;
        return !!hoverComponent && (
            <Animated.View style={[
                horizontal ? styles.hoverComponentHorizontal : styles.hoverComponentVertical,
                {
                    transform: [
                        horizontal ? { translateX: this._hoverAnim } : { translateY: this._hoverAnim },
                        { scaleX: scaleSelectionFactor },
                        { scaleY: scaleSelectionFactor }
                    ]
                }
            ]}>
                {hoverComponent}
            </Animated.View>
        )
    };

    renderHeaderComponent = () => {
        const { ListHeaderComponent, horizontal } = this.props;
        return !!ListHeaderComponent && (
            <View
                onLayout={e => {
                    this._headerSize = e.nativeEvent.layout[horizontal ? 'width' : 'height'];
                }}>
                <ListHeaderComponent />
            </View>
        )
    };

    keyExtractor = (item, index) => `sortable-flatlist-item-${index}`;

    render() {
        const { horizontal, keyExtractor, removeClippedSubviews } = this.props;

        return (
            <View
                onLayout={e => {
                    this._container.measure((x, y, width, height, pageX, pageY) => {
                        this._containerOffset = horizontal ? pageX : pageY;
                        this._containerSize = horizontal ? width : height;
                        this.initPositions();
                    })
                }}
                ref={(ref) => {
                    this._container = ref;
                }}
                collapsable={false}
                {...this._panResponder.panHandlers}
                style={styles.wrapper}>
                <FlatList
                    {...this.props}
                    ListHeaderComponent={this.renderHeaderComponent}
                    removeClippedSubviews={removeClippedSubviews}
                    scrollEnabled={this._tappedRow === -1}
                    ref={ref => this._flatList = ref}
                    renderItem={this.renderItem}
                    extraData={this.state}
                    keyExtractor={keyExtractor || this.keyExtractor}
                    onScroll={({ nativeEvent }) => {
                        this._scrollOffset = nativeEvent.contentOffset[horizontal ? 'x' : 'y'];
                    } }
                    scrollEventThrottle={16}
                />
                {this.renderHoverComponent()}
            </View>
        )
    }
}

export default DraggableFlatList

DraggableFlatList.defaultProps = {
    scrollPercent: 5,
    scrollSpeed: 10,
    scaleSelectionFactor: 0.95,
    removeClippedSubviews: false
};

class RowItem extends React.PureComponent {

    move = () => {
        const { move, moveEnd, renderItem, item, index } = this.props;
        const hoverComponent = renderItem({ isActive: true, item, index, move: () => null, moveEnd });
        move(hoverComponent, index)
    };

    render() {
        const { moveEnd, isActiveRow, horizontal, renderItem, item, index } = this.props;
        const component = renderItem({
            isActive: false,
            item,
            index,
            move: this.move,
            moveEnd,
        });
        let wrapperStyle = { opacity: 1 };
        if (isActiveRow) wrapperStyle = { display: 'none' };

        // Rendering the final row requires padding to be applied at the bottom
        return (
            <View collapsable={false} style={{ opacity: 1, flexDirection: horizontal ? 'row' : 'column' }}>
                <View style={wrapperStyle}>
                    {component}
                </View>
            </View>
        )
    }
}

const styles = StyleSheet.create({
    hoverComponentVertical: {
        position: 'absolute',
        left: 0,
        right: 0,
    },
    hoverComponentHorizontal: {
        position: 'absolute',
        bottom: 0,
        top: 0,
    },
    wrapper: { flex: 1, opacity: 1 },
    fullOpacity: { opacity: 1 }
});
