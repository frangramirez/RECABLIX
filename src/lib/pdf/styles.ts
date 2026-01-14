import { StyleSheet } from '@react-pdf/renderer'

export const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6'
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: '#EFF6FF',
    padding: 8,
  },
  section: {
    marginBottom: 15
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3
  },
  label: {
    width: '40%',
    color: '#6B7280'
  },
  value: {
    width: '60%',
    fontWeight: 'bold'
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  gridItem: {
    width: '50%',
    marginBottom: 4
  },
  table: {
    marginTop: 10
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    color: 'white',
    padding: 5,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    padding: 4
  },
  tableRowHighlight: {
    backgroundColor: '#FEF3C7'
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 8
  },
  bigBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 15,
    padding: 15,
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
  },
  bigBoxItem: {
    textAlign: 'center'
  },
  bigLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4
  },
  bigValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E40AF'
  },
  placeholder: {
    padding: 20,
    backgroundColor: '#F3F4F6',
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#9CA3AF',
  },
})
